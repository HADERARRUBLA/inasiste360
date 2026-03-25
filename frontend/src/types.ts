export type EventType = 'in' | 'out' | 'breakfast' | 'lunch' | 'active_pause' | 'other';
export type UserRole = 'superadmin' | 'admin' | 'employee';

export interface DaySchedule {
    start: string;
    end: string;
    active: boolean;
}

export interface WeeklySchedule {
    [key: string]: DaySchedule;
}

export interface Organization {
    id: string;
    name: string;
    nit?: string;
    is_active: boolean;
    created_at?: string;
}

export interface Company { // USADA COMO SEDE
    id: string;
    organization_id: string;
    name: string;
    address?: string;
    lat_long: string | null;
    radius_limit: number;
    night_shift_start_time?: string;
    extra_day_start_time?: string;
    work_schedule?: WeeklySchedule;
    created_at?: string;
    InA_organizations?: Organization;
}

export interface Profile {
    id: string;
    organization_id: string | null;
    company_id: string | null; // Sede principal
    full_name: string;
    national_id?: string;
    phone_number?: string;
    pin_code?: string;
    face_vector?: number[];
    profile_photo?: string | null;
    hourly_rate_base: number;
    hourly_rate_extra_day?: number;
    hourly_rate_extra_night?: number;
    hourly_rate_sunday_holiday?: number;
    hourly_rate_sunday_holiday_extra_day?: number;
    hourly_rate_sunday_holiday_extra_night?: number;
    use_custom_schedule?: boolean;
    work_start_time?: string;
    work_end_time?: string;
    work_schedule?: WeeklySchedule;
    role: UserRole;
    InA_organizations?: Organization;
    InA_companies?: Company; // Sede
}

export interface TimeEntry {
    id: string;
    profile_id: string;
    company_id: string;
    event_type: EventType;
    is_verified: boolean;
    clock_in?: string;
    clock_out?: string;
    geo_snapshot?: { lat: number; lng: number };
    metadata: any;
    created_at?: string;
    date?: string; // Derived field if needed
    InA_profiles?: Profile;
}

export type TimeEntryWithProfile = TimeEntry & { InA_profiles: Profile };
