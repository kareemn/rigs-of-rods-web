// SPDX-License-Identifier: GPL-3.0-only
#include "../physics/world.hpp"
#include <cassert>
#include <iostream>
using namespace rorweb;
static bool near(float a, float b, float tolerance = 1e-4f) {
    return std::abs(a - b) < tolerance;
}
int main() {
    Node a, b;
    a.p = {0, 0, 0};
    b.p = {1, 0, 0};
    Beam beam;
    beam.k = 1000;
    beam.d = 0;
    beam.compressionYield = 100;
    beam.tensionYield = -100;
    beam.strength = 10000;
    beam.plastic = 0.5f;
    auto original = beam;
    assert(near(beamForce(beam, a, b).length(), 0));
    b.p.x = 0.95f;
    assert(near(beamForce(beam, a, b).x, -50));
    assert(near(beam.rest, 1));
    beam = original;
    b.p.x = 0.8f;
    assert(near(beamForce(beam, a, b).x, -150));
    assert(near(beam.rest, 0.85f));
    assert(near(beam.compressionYield, 100 / 0.85f));
    // The new rest length remains after unloading; this is permanent crush.
    b.p.x = beam.rest;
    assert(near(beamForce(beam, a, b).length(), 0));
    assert(near(beam.rest, 0.85f));
    beam = original;
    b.p.x = 1.2f;
    assert(near(beamForce(beam, a, b).x, 150));
    assert(near(beam.rest, 1.15f));
    assert(near(beam.strength, 9850));
    beam = original;
    beam.strength = 110;
    b.p.x = 0.8f;
    assert(near(beamForce(beam, a, b).length(), 0));
    assert(beam.broken);
    beam = original;
    b.p = a.p;
    assert(near(beamForce(beam, a, b).length(), 0));

    // Swept node/triangle impact with all four masses dynamic: preserve momentum.
    World world;
    Node projectile;
    projectile.p = projectile.previous = {0.02f, 0, 0};
    projectile.v = {-100, 0, 0};
    projectile.inverseMass = 0.5f;
    projectile.body = 0;
    world.nodes.push_back(projectile);
    for (Vec3 p : {Vec3{0, -1, -1}, Vec3{0, 1, -1}, Vec3{0, 0, 1}}) {
        Node n;
        n.p = n.previous = p;
        n.body = 1;
        world.nodes.push_back(n);
    }
    world.triangles.push_back({1, 2, 3, 1});
    world.step(1);
    assert(world.totalContacts > 0);
    Vec3 momentum;
    for (auto n : world.nodes)
        momentum += n.v * (1 / n.inverseMass);
    assert(near(momentum.x, -200, 1e-3f));
    assert(near(momentum.y, 0));
    assert(near(momentum.z, 0));
    assert(world.nodes[0].v.x > -100);

    // Batched vs individual timesteps must follow exactly the same state sequence.
    World left, right;
    Node n1, n2;
    n1.p = {0, 1, 0};
    n2.p = {1.01f, 1, 0};
    left.nodes = {n1, n2};
    beam = original;
    beam.a = 0;
    beam.b = 1;
    left.beams = {beam};
    right = left;
    left.step(200);
    for (int i = 0; i < 200; i++)
        right.step(1);
    assert(left.positions == right.positions);
    for (auto n : left.nodes)
        assert(std::isfinite(n.p.x));
    std::cout << "Native beam, permanent yield, fracture, swept contact, momentum, batch "
                 "determinism: PASS\n";
}
