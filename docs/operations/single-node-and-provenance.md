# Current deployment boundaries

The production Lume server is single-node. It uses a local SQLite database and
process-local WebSocket presence and voice reservations. Do not increase the
number of `lume` replicas or route traffic to another app instance. A restart
interrupts live calls; deploy only through the health-checked promotion script.
Capacity of the current Oracle VM has not been measured. Record concurrent
connections, calls, CPU, memory and request latency under representative load
before choosing a scaling design. Horizontal scaling requires shared database
and real-time coordination first.

This repository remains a derivative of Backspace: the `@backspace/*` package
names, database filename and compatibility variables remain in use, and the
repository and running service declare AGPL-3.0-only. The root compose's stale
upstream image has been replaced, but operational names should only be renamed
with a tested migration. Do not remove copyright, license or source-offer
notices or distribute this code as closed source. Independent module rewrites
and specialist legal review are prerequisites to any closed-source release.
