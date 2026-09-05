import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AuditEvent {
    id: bigint;
    requestId?: bigint;
    stylistId?: bigint;
    kind: string;
    createdAt: bigint;
    detail: string;
}
export type Result = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export interface ClientRequest {
    id: bigint;
    service: string;
    status: string;
    assignedStylistId?: bigint;
    recommendedStylistId?: bigint;
    idempotencyKey: string;
    timing: string;
    backupStylistId?: bigint;
    clientName: string;
    explanation: string;
    createdAt: bigint;
    specialtyMatters: boolean;
    updatedAt: bigint;
    notes: string;
    requestedTime: string;
    revision: bigint;
}
export interface Backup {
    dashboard: Dashboard;
    exportedAt: bigint;
    version: bigint;
}
export interface StylistInput {
    name: string;
    acceptsNewClients: boolean;
    availabilityExpiresAt: bigint;
    availabilityNote: string;
    phone: string;
    services: Array<ServicePreference>;
    availabilityStatus: string;
}
export interface Dashboard {
    audit: Array<AuditEvent>;
    stylists: Array<Stylist>;
    requests: Array<ClientRequest>;
}
export interface Stylist {
    id: bigint;
    active: boolean;
    assignments: bigint;
    name: string;
    createdAt: bigint;
    acceptsNewClients: boolean;
    availabilityExpiresAt: bigint;
    updatedAt: bigint;
    eligibleOpportunities: bigint;
    noResponses: bigint;
    lastAssignedAt: bigint;
    availabilityNote: string;
    phone: string;
    declines: bigint;
    revision: bigint;
    services: Array<ServicePreference>;
    availabilityStatus: string;
}
export interface Stylist__1 {
    name: string;
    specialty: string;
    availability: string;
}
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export interface RouteInput {
    service: string;
    idempotencyKey: string;
    timing: string;
    clientName: string;
    specialtyMatters: boolean;
    notes: string;
    requestedTime: string;
}
export interface RoutingResult {
    request: ClientRequest;
    backup?: Stylist;
    recommended?: Stylist;
}
export interface ServicePreference {
    name: string;
    level: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addStylist(stylist: Stylist__1): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    assignRequest(requestId: bigint, stylistId: bigint, expectedRevision: bigint, note: string): Promise<ClientRequest>;
    createStylist(input: StylistInput): Promise<Stylist>;
    exportBackup(): Promise<Backup>;
    getApiDoc(): Promise<string>;
    getCallerUserRole(): Promise<UserRole>;
    getDashboard(): Promise<Dashboard>;
    getStylists(): Promise<Array<Stylist__1>>;
    isCallerAdmin(): Promise<boolean>;
    routeClient(input: RouteInput): Promise<RoutingResult>;
    setRequestStatus(requestId: bigint, status: string, expectedRevision: bigint, reason: string): Promise<ClientRequest>;
    setStylistActive(id: bigint, active: boolean, expectedRevision: bigint): Promise<Stylist>;
    updateStylist(id: bigint, input: StylistInput, expectedRevision: bigint): Promise<Stylist>;
    useBackup(requestId: bigint, expectedRevision: bigint, reason: string): Promise<RoutingResult>;
}
