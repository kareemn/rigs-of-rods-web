// SPDX-License-Identifier: GPL-3.0-only
// Copyright 2026 kareemn.
#include "world.hpp"
#include <emscripten/emscripten.h>
using namespace rorweb;
static World world;
extern "C" {
EMSCRIPTEN_KEEPALIVE void reset_world() {
    world = World{};
}
EMSCRIPTEN_KEEPALIVE int add_node(float x, float y, float z, float vx, float vy, float vz,
                                  float mass, int body) {
    if (world.nodes.size() >= 512 || body < 0 || body >= 8 ||
        !std::isfinite(x + y + z + vx + vy + vz + mass) || mass < 0)
        return -1;
    Node n;
    n.p = n.previous = {x, y, z};
    n.v = {vx, vy, vz};
    n.inverseMass = mass > 0 ? 1 / mass : 0;
    n.body = body;
    world.nodes.push_back(n);
    return world.nodes.size() - 1;
}
EMSCRIPTEN_KEEPALIVE int add_beam(int a, int b, float k, float d, float yield, float strength,
                                  float plastic) {
    if (world.beams.size() >= 4096 || a < 0 || b < 0 || a == b || a >= int(world.nodes.size()) ||
        b >= int(world.nodes.size()) || !std::isfinite(k + d + yield + strength + plastic) ||
        k <= 0 || d < 0 || yield <= 0 || strength < yield || plastic < 0 || plastic > 1)
        return -1;
    float len = (world.nodes[a].p - world.nodes[b].p).length();
    if (len < 0.1f)
        return -1;
    Beam beam;
    beam.a = a;
    beam.b = b;
    beam.rest = beam.initialRest = len;
    beam.k = k;
    beam.d = d;
    beam.compressionYield = yield;
    beam.tensionYield = -yield;
    beam.strength = strength;
    beam.plastic = plastic;
    world.beams.push_back(beam);
    return world.beams.size() - 1;
}
EMSCRIPTEN_KEEPALIVE int add_triangle(int a, int b, int c) {
    if (world.triangles.size() >= 2048 || a < 0 || b < 0 || c < 0 || a == b || a == c || b == c ||
        a >= int(world.nodes.size()) || b >= int(world.nodes.size()) ||
        c >= int(world.nodes.size()))
        return -1;
    int body = world.nodes[a].body;
    if (world.nodes[b].body != body || world.nodes[c].body != body)
        return -1;
    world.triangles.push_back({a, b, c, body});
    return world.triangles.size() - 1;
}
EMSCRIPTEN_KEEPALIVE void set_environment(int barrier, float x, int gravity) {
    world.barrier = barrier;
    world.barrierX = x;
    world.gravity = gravity;
}
EMSCRIPTEN_KEEPALIVE int step_world(int ticks) {
    if (ticks < 0 || ticks > 200)
        return -1;
    world.step(ticks);
    return 0;
}
EMSCRIPTEN_KEEPALIVE const float *get_positions() {
    return world.positions.data();
}
EMSCRIPTEN_KEEPALIVE const float *get_velocities() {
    return world.velocities.data();
}
EMSCRIPTEN_KEEPALIVE const float *get_damage() {
    return world.damage.data();
}
EMSCRIPTEN_KEEPALIVE const float *get_stats() {
    return world.stats.data();
}
}
