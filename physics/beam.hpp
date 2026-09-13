// SPDX-License-Identifier: GPL-3.0-only
// Adapted from Rigs of Rods ActorForcesEuler.cpp, Actor::CalcBeams.
// Copyright 2005-2012 Pierre-Michel Ricordel
// Copyright 2007-2012 Thomas Fischer
// Browser extraction and modifications Copyright 2026 kareemn.
// See upstream/README.md for exact provenance and changes. No warranty.
#pragma once
#include <algorithm>
#include <cmath>

namespace rorweb {
struct Vec3 {
    float x=0, y=0, z=0;
    Vec3 operator+(Vec3 b) const { return {x+b.x,y+b.y,z+b.z}; }
    Vec3 operator-(Vec3 b) const { return {x-b.x,y-b.y,z-b.z}; }
    Vec3 operator*(float s) const { return {x*s,y*s,z*s}; }
    Vec3& operator+=(Vec3 b) { x+=b.x;y+=b.y;z+=b.z;return *this; }
    Vec3& operator-=(Vec3 b) { x-=b.x;y-=b.y;z-=b.z;return *this; }
    float dot(Vec3 b) const { return x*b.x+y*b.y+z*b.z; }
    Vec3 cross(Vec3 b) const { return {y*b.z-z*b.y,z*b.x-x*b.z,x*b.y-y*b.x}; }
    float length() const { return std::sqrt(dot(*this)); }
};
struct Node { Vec3 p, previous, v, force; float inverseMass=1; int body=0; };
struct Beam {
    int a=0,b=0;
    float rest=1, initialRest=1, k=100000, d=200;
    float compressionYield=10000, tensionYield=-10000, strength=100000;
    float plastic=0.5f, stress=0;
    bool broken=false;
};

// Ordinary BEAM_NORMAL only. Hydros, shocks, ropes and detacher groups are not ported.
inline Vec3 beamForce(Beam& beam, const Node& a, const Node& b, bool canBreak=true) {
    if (beam.broken) return {};
    const Vec3 displacement = a.p - b.p;
    const float length = displacement.length();
    if (length < 1e-7f) return {}; // Explicit zero-length guard, absent in upstream approximation.
    const float inverseLength = 1.0f / length;
    const float extension = length - beam.rest;
    const float velocity = (a.v - b.v).dot(displacement) * inverseLength;
    float force = -beam.k * extension - beam.d * velocity;
    beam.stress = force;
    float magnitude = std::abs(force);
    const float threshold = std::min({beam.compressionYield, -beam.tensionYield, beam.strength});
    if (magnitude > threshold) {
        if (beam.k != 0) {
            if (force > beam.compressionYield && extension < 0) {
                const float yieldLength = beam.compressionYield / beam.k;
                const float deformation = extension + yieldLength * (1.0f - beam.plastic);
                const float oldLength = beam.rest;
                beam.rest = std::max(0.1f, beam.rest + deformation);
                force -= (force - beam.compressionYield) * 0.5f;
                magnitude = force;
                if (oldLength > beam.rest) beam.compressionYield *= oldLength / beam.rest;
            } else if (force < beam.tensionYield && extension > 0) {
                const float yieldLength = beam.tensionYield / beam.k;
                const float deformation = extension + yieldLength * (1.0f - beam.plastic);
                const float oldLength = beam.rest;
                beam.rest += deformation;
                force -= (force - beam.tensionYield) * 0.5f;
                magnitude = -force;
                if (oldLength > 0 && beam.rest > oldLength) beam.tensionYield *= beam.rest / oldLength;
                beam.strength -= deformation * beam.k;
            }
        }
        if (magnitude > beam.strength) {
            if (canBreak) { force=0; beam.broken=true; }
            else beam.strength = 2.0f * std::min({beam.compressionYield,-beam.tensionYield,beam.strength});
        }
    }
    return displacement * (force * inverseLength);
}
} // namespace rorweb
