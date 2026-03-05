export type EventType = 'in' | 'out' | 'breakfast' | 'lunch' | 'active_pause' | 'other';
export type UserRole = 'superadmin' | 'admin' | 'employee';

export interface Company {
    id: string;
    name: string;
    address?: string;
    lat_long: string | null;
    radius_limit: number;
    created_at?: string;
}

export interface Profile {
    id: string;
    company_id: string | null;
    full_name: string;
    national_id?: string;
    phone_number?: string;
    pin_code?: string;
    face_vector?: number[];
    profile_photo?: string | null;
    hourly_rate_base: number;
    night_surcharge_pct: number;
    sunday_holiday_surcharge_pct: number;
    role: UserRole;
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
    profiles?: Profile;
}

export type TimeEntryWithProfile = TimeEntry & { profiles: Profile };
