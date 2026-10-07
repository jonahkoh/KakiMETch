-- Daily MET vehicle scheduling and route plans.

create table public.drivers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    available_from time not null default '06:30',
    available_until time not null default '15:00',
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (available_from < available_until)
);

create table public.vehicles (
    id uuid primary key default gen_random_uuid(),
    plate_number text not null unique,
    driver_id uuid not null references public.drivers(id) on delete restrict,
    passenger_pair_capacity integer not null default 3 check (passenger_pair_capacity > 0),
    max_daily_services integer not null default 8 check (max_daily_services > 0),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

with seeded_driver as (
    insert into public.drivers (name)
    values ('Driver A')
    returning id
)
insert into public.vehicles (plate_number, driver_id)
select 'PC2345L', id from seeded_driver;

with seeded_driver as (
    insert into public.drivers (name)
    values ('Driver B')
    returning id
)
insert into public.vehicles (plate_number, driver_id)
select 'PC8213U', id from seeded_driver;

alter table public.trips
    add column pickup_address text,
    add column return_ready_time time;

create table public.route_plans (
    id uuid primary key default gen_random_uuid(),
    service_date date not null,
    status text not null default 'optimised'
        check (status in ('optimised', 'manually_adjusted')),
    matrix_source text not null,
    total_travel_minutes integer not null default 0,
    unallocated_returns uuid[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.route_plan_assignments (
    id uuid primary key default gen_random_uuid(),
    route_plan_id uuid not null references public.route_plans(id) on delete cascade,
    vehicle_id uuid not null references public.vehicles(id) on delete restrict,
    trip_id uuid not null references public.trips(id) on delete cascade,
    sequence integer not null check (sequence >= 0),
    outbound_pickup_at time,
    outbound_dropoff_at time,
    return_pickup_at time,
    return_dropoff_at time,
    stop_summary jsonb not null default '[]'::jsonb,
    unique (route_plan_id, trip_id),
    unique (route_plan_id, vehicle_id, sequence)
);

create index route_plans_service_date_idx
    on public.route_plans (service_date, created_at desc);
create index route_plan_assignments_plan_vehicle_idx
    on public.route_plan_assignments (route_plan_id, vehicle_id, sequence);
create index trips_appt_date_pickup_idx
    on public.trips (appt_date, pickup_address)
    where status in ('accepted', 'scheduled');
