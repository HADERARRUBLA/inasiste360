export type EventType = 'in' | 'out' | 'breakfast' | 'lunch' | 'active_pause' | 'other';
export type UserRole = 'superadmin' | 'admin' | 'employee';
export type ScheduleMode = 'branch' | 'custom' | 'open';

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
    schedule_mode: ScheduleMode;
    open_no_overtime?: boolean;
    open_max_ordinary_minutes?: number;
    work_start_time?: string;
    work_end_time?: string;
    work_schedule?: WeeklySchedule;
    role: UserRole;
    InA_organizations?: Organization;
    InA_companies?: Company; // Sede
}

export interface TimeEntryMetadata {
    biometric_match: boolean | null;
    biometric_confidence: number | null;
    method: 'photo-evidence' | 'pin-only';
    event_label?: string;
    is_return?: boolean;
    full_evidence?: boolean;
    photo_evidence?: string | null;
    ip?: string;
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
    location_snapshot?: { lat: number; lng: number } | null;
    metadata: TimeEntryMetadata | any; // Permitting transition, but focusing on new structure
    created_at?: string;
    date?: string; // Derived field if needed
    InA_profiles?: Profile;
    profiles?: Profile; // Para compatibilidad con joins específicos
}

export type TimeEntryWithProfile = TimeEntry & { InA_profiles: Profile };

export type LeaveType =
    | 'vacaciones'
    | 'incapacidad_eps'
    | 'incapacidad_arl'
    | 'permiso_remunerado'
    | 'permiso_no_remunerado'
    | 'licencia_maternidad'
    | 'licencia_paternidad'
    | 'luto'
    | 'otro';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
    id: string;
    profile_id: string;
    type: LeaveType;
    start_date: string;
    end_date: string;
    status: LeaveStatus;
    notes?: string | null;
    decision_notes?: string | null;
    attachment_url?: string | null;
    requested_by?: string | null;
    approved_by?: string | null;
    created_at?: string;
    InA_profiles?: Profile;
}

export interface LeaveRequestAudit {
    id: string;
    leave_request_id: string | null;
    organization_id: string;
    action: 'update' | 'delete';
    changed_by: string | null;
    changed_at: string;
    old_data: Record<string, any> | null;
    new_data: Record<string, any> | null;
    InA_profiles?: Profile;
}

export interface EmployeeHrProfile {
    profile_id: string;
    hire_date?: string | null;
    marital_status?: string | null;
    children_count?: number | null;
    education_level?: string | null;
    eps?: string | null;
    arl?: string | null;
    compensation_fund?: string | null;
    pension_fund?: string | null;
    updated_at?: string;
}

export type DocType = 'hoja_de_vida' | 'otro';

export interface EmployeeDocument {
    id: string;
    profile_id: string;
    doc_type: DocType;
    file_name: string;
    storage_path: string;
    uploaded_by?: string | null;
    uploaded_at?: string;
}
