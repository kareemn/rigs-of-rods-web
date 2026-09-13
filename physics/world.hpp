// SPDX-License-Identifier: GPL-3.0-only
// Copyright 2026 kareemn. New browser host; contact solver is not RoR's collision system.
#pragma once
#include "beam.hpp"
#include <array>
#include <stdexcept>
#include <vector>

namespace rorweb {
constexpr float dt = 0.0005f;
struct Triangle {
    int a, b, c, body;
};
struct Bounds {
    Vec3 lo{1e9f, 1e9f, 1e9f}, hi{-1e9f, -1e9f, -1e9f};
    void include(Vec3 p) {
        lo = {std::min(lo.x, p.x), std::min(lo.y, p.y), std::min(lo.z, p.z)};
        hi = {std::max(hi.x, p.x), std::max(hi.y, p.y), std::max(hi.z, p.z)};
    }
    bool contains(Vec3 p, float r) const {
        return p.x >= lo.x - r && p.x <= hi.x + r && p.y >= lo.y - r && p.y <= hi.y + r &&
               p.z >= lo.z - r && p.z <= hi.z + r;
    }
};
// Barycentric coordinates of the closest point on a triangle (including edges).
inline Vec3 closestWeights(Vec3 p, Vec3 a, Vec3 b, Vec3 c) {
    Vec3 ab = b - a, ac = c - a, ap = p - a;
    float d1 = ab.dot(ap), d2 = ac.dot(ap);
    if (d1 <= 0 && d2 <= 0)
        return {1, 0, 0};
    Vec3 bp = p - b;
    float d3 = ab.dot(bp), d4 = ac.dot(bp);
    if (d3 >= 0 && d4 <= d3)
        return {0, 1, 0};
    float vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        float v = d1 / (d1 - d3);
        return {1 - v, v, 0};
    }
    Vec3 cp = p - c;
    float d5 = ab.dot(cp), d6 = ac.dot(cp);
    if (d6 >= 0 && d5 <= d6)
        return {0, 0, 1};
    float vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        float w = d2 / (d2 - d6);
        return {1 - w, 0, w};
    }
    float va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
        float w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return {0, 1 - w, w};
    }
    float denominator = va + vb + vc;
    if (std::abs(denominator) < 1e-15f)
        return {1, 0, 0};
    float v = vb / denominator, w = vc / denominator;
    return {1 - v - w, v, w};
}
class World {
  public:
    std::vector<Node> nodes;
    std::vector<Beam> beams;
    std::vector<Triangle> triangles;
    std::vector<float> positions, velocities, damage;
    std::array<float, 8> stats{};
    int ticks = 0, contacts = 0, totalContacts = 0;
    bool barrier = false, gravity = false;
    float barrierX = 0;

    void step(int count) {
        contacts = 0;
        for (int t = 0; t < count; t++) {
            std::vector<int> connected(nodes.size(), 0);
            for (auto &b : beams)
                if (!b.broken) {
                    connected[b.a]++;
                    connected[b.b]++;
                }
            for (auto &n : nodes) {
                n.previous = n.p;
                n.force = {};
                if (gravity && n.inverseMass > 0)
                    n.force.y = -9.807f / n.inverseMass;
            }
            for (auto &b : beams) {
                Vec3 f =
                    beamForce(b, nodes[b.a], nodes[b.b], connected[b.a] > 2 && connected[b.b] > 2);
                nodes[b.a].force += f;
                nodes[b.b].force -= f;
            }
            for (auto &n : nodes)
                if (n.inverseMass > 0) {
                    n.v += n.force * (n.inverseMass * dt);
                    n.p += n.v * dt;
                }
            // Three contact iterations. The radius is a visible 15 mm contact skin.
            for (int iteration = 0; iteration < 3; iteration++) {
                std::array<Bounds, 8> bounds;
                for (auto &n : nodes) {
                    bounds[n.body].include(n.p);
                    bounds[n.body].include(n.previous);
                }
                for (size_t ni = 0; ni < nodes.size(); ni++) {
                    auto &n = nodes[ni];
                    for (auto tri : triangles) {
                        if (n.body == tri.body || (!bounds[tri.body].contains(n.p, 0.03f) &&
                                                   !bounds[tri.body].contains(n.previous, 0.03f)))
                            continue;
                        contact(n, tri);
                    }
                    if (barrier && n.p.x > barrierX - 0.015f && n.inverseMass > 0) {
                        n.p.x = barrierX - 0.015f;
                        if (n.v.x > 0)
                            n.v.x = 0;
                        contacts++;
                        totalContacts++;
                    }
                    if (gravity && n.p.y < 0.02f && n.inverseMass > 0) {
                        n.p.y = 0.02f;
                        if (n.v.y < 0)
                            n.v.y = 0;
                    }
                }
            }
            ticks++;
        }
        updateBuffers();
    }
    void updateBuffers() {
        positions.resize(nodes.size() * 3);
        velocities.resize(nodes.size() * 3);
        damage.resize(beams.size());
        float energy = 0, maxSpeed = 0, maxDamage = 0;
        int broken = 0, changed = 0;
        for (size_t i = 0; i < nodes.size(); i++) {
            auto &n = nodes[i];
            positions[i * 3] = n.p.x;
            positions[i * 3 + 1] = n.p.y;
            positions[i * 3 + 2] = n.p.z;
            velocities[i * 3] = n.v.x;
            velocities[i * 3 + 1] = n.v.y;
            velocities[i * 3 + 2] = n.v.z;
            if (n.inverseMass > 0)
                energy += 0.5f * n.v.dot(n.v) / n.inverseMass;
            maxSpeed = std::max(maxSpeed, n.v.length());
        }
        for (size_t i = 0; i < beams.size(); i++) {
            auto &b = beams[i];
            float strain = std::abs(b.rest / b.initialRest - 1);
            damage[i] = b.broken ? -1 : strain;
            maxDamage = std::max(maxDamage, strain);
            broken += b.broken;
            changed += strain > 0.005f;
        }
        stats = {ticks * dt,     energy,        float(contacts), float(totalContacts),
                 float(changed), float(broken), maxDamage,       maxSpeed};
    }

  private:
    void contact(Node &n, Triangle tri) {
        auto &a = nodes[tri.a];
        auto &b = nodes[tri.b];
        auto &c = nodes[tri.c];
        Vec3 normal = (b.p - a.p).cross(c.p - a.p);
        float area = normal.length();
        if (area < 1e-8f)
            return;
        normal = normal * (1 / area);
        Vec3 w = closestWeights(n.p, a.p, b.p, c.p);
        Vec3 q = a.p * w.x + b.p * w.y + c.p * w.z;
        Vec3 delta = n.p - q;
        float signedDistance = (n.p - a.p).dot(normal);
        float priorDistance =
            (n.previous - (a.previous * w.x + b.previous * w.y + c.previous * w.z)).dot(normal);
        // Swept entry through a face; 0.5 ms substeps also limit triangle motion.
        bool crossing = priorDistance >= 0 && signedDistance < 0;
        if (crossing) {
            const float fraction = priorDistance / (priorDistance - signedDistance);
            Vec3 at = n.previous + (n.p - n.previous) * fraction;
            Vec3 ta = a.previous + (a.p - a.previous) * fraction;
            Vec3 tb = b.previous + (b.p - b.previous) * fraction;
            Vec3 tc = c.previous + (c.p - c.previous) * fraction;
            w = closestWeights(at, ta, tb, tc);
            Vec3 hit = ta * w.x + tb * w.y + tc * w.z;
            if ((at - hit).length() > 0.02f)
                crossing = false;
        }
        float penetration = 0;
        if (crossing)
            penetration = 0.015f - signedDistance;
        else {
            float distance = delta.length();
            if (distance >= 0.015f || signedDistance < -0.015f)
                return;
            if (distance > 1e-7f && signedDistance >= 0)
                normal = delta * (1 / distance);
            penetration = 0.015f - distance;
        }
        if (penetration <= 0)
            return;
        float inverseMass = n.inverseMass + a.inverseMass * w.x * w.x + b.inverseMass * w.y * w.y +
                            c.inverseMass * w.z * w.z;
        if (inverseMass <= 0)
            return;
        Vec3 correction = normal * (penetration / inverseMass);
        n.p += correction * n.inverseMass;
        a.p -= correction * (a.inverseMass * w.x);
        b.p -= correction * (b.inverseMass * w.y);
        c.p -= correction * (c.inverseMass * w.z);
        Vec3 relative = n.v - (a.v * w.x + b.v * w.y + c.v * w.z);
        float closing = relative.dot(normal);
        if (closing < 0) {
            Vec3 impulse = normal * (-closing / inverseMass); // Zero restitution: plastic contact.
            n.v += impulse * n.inverseMass;
            a.v -= impulse * (a.inverseMass * w.x);
            b.v -= impulse * (b.inverseMass * w.y);
            c.v -= impulse * (c.inverseMass * w.z);
        }
        contacts++;
        totalContacts++;
    }
};
} // namespace rorweb
