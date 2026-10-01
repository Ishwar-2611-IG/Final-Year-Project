// ============================================================
// MedBlock Mock API — Full Advanced Drop-in Replacement
// Covers: Auth, Patient, Doctor, Hospital, Admin portals
// ============================================================

// =====================
// TYPES
// =====================

export type UserRole = "patient" | "doctor" | "hospital" | "admin";

export type RecordStatus = "active" | "archived" | "pending";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "in-progress";
export type RecordType = "lab" | "prescription" | "imaging" | "consultation" | "vaccination" | "surgery";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type Gender = "male" | "female" | "other";
export type DoctorStatus = "active" | "on-leave" | "inactive";

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  hospitalName?: string;
  address: string | null; // wallet address
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
  twoFactorEnabled?: boolean;
  verified?: boolean;
}

export interface PatientProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string;
  email: string;
  address: string;
  emergencyContact: { name: string; relation: string; phone: string };
  allergies: string[];
  chronicConditions: string[];
  insuranceProvider: string;
  insuranceId: string;
  ipfsHash: string;
  walletAddress: string | null;
}

export interface DoctorProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  specialty: string;
  licenseNumber: string;
  phone: string;
  email: string;
  hospitalId: string;
  hospitalName: string;
  experience: number; // years
  rating: number;
  totalPatients: number;
  status: DoctorStatus;
  availability: { day: string; slots: string[] }[];
  qualifications: string[];
  avatar?: string;
}

export interface HealthRecord {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  type: RecordType;
  title: string;
  description: string;
  diagnosis?: string;
  medications?: { name: string; dosage: string; frequency: string; duration: string }[];
  labResults?: { test: string; value: string; unit: string; normalRange: string; status: "normal" | "abnormal" | "critical" }[];
  attachments?: { name: string; ipfsHash: string; size: string }[];
  date: string;
  status: RecordStatus;
  ipfsHash: string;
  blockchainTxHash: string;
  encryptionKey?: string;
  tags: string[];
  isShared: boolean;
  sharedWith: string[]; // doctor IDs
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospitalId: string;
  hospitalName: string;
  date: string;
  time: string;
  duration: number; // minutes
  type: "in-person" | "video" | "phone";
  status: AppointmentStatus;
  reason: string;
  notes?: string;
  prescription?: string;
  followUp?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  ipAddress: string;
  timestamp: string;
  txHash?: string;
  status: "success" | "failed";
}

export interface HospitalStats {
  totalDoctors: number;
  totalPatients: number;
  totalAppointments: number;
  todayAppointments: number;
  pendingRecords: number;
  revenue: { month: string; amount: number }[];
  appointmentsByStatus: Record<AppointmentStatus, number>;
  recordsByType: Record<RecordType, number>;
  recentActivity: AuditLog[];
}

export interface PatientStats {
  totalRecords: number;
  totalAppointments: number;
  upcomingAppointments: number;
  totalDoctors: number;
  recentActivity: AuditLog[];
  healthScore: number;
  recordsByType: Record<RecordType, number>;
}

export interface DoctorStats {
  totalPatients: number;
  todayAppointments: number;
  pendingReviews: number;
  completedAppointments: number;
  rating: number;
  recentPatients: PatientProfile[];
  appointmentsByMonth: { month: string; count: number }[];
}

export interface AdminStats {
  totalUsers: number;
  totalHospitals: number;
  totalDoctors: number;
  totalPatients: number;
  totalRecords: number;
  blockchainSyncStatus: "synced" | "syncing" | "error";
  lastSyncBlock: number;
  ipfsNodes: number;
  systemHealth: { service: string; status: "up" | "down" | "degraded"; latency: number }[];
  recentAuditLogs: AuditLog[];
  userGrowth: { month: string; count: number }[];
}

type RequestBody = Record<string, any> | undefined;

// =====================
// HELPERS
// =====================

const delay = (ms = 900) => new Promise((resolve) => setTimeout(resolve, ms));

const generateToken = (user: User): string =>
  btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role, timestamp: Date.now() }));

const uuid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const randomTxHash = () =>
  "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const randomIpfsHash = () =>
  "Qm" + Array.from({ length: 44 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random() * 58)]).join("");

const today = () => new Date().toISOString().split("T")[0];
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split("T")[0];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split("T")[0];

// =====================
// DEMO USERS
// =====================

const DEMO_USERS: Record<UserRole, User> = {
  patient: {
    id: "USR-PAT-001",
    email: "john.doe@example.com",
    password: "Admin@1234",
    role: "patient",
    firstName: "John",
    lastName: "Doe",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    createdAt: "2024-01-15T10:00:00Z",
    lastLogin: new Date().toISOString(),
    twoFactorEnabled: false,
    verified: true,
  },
  doctor: {
    id: "USR-DOC-001",
    email: "dr.sarah.connor@citygeneral.com",
    password: "Admin@1234",
    role: "doctor",
    firstName: "Sarah",
    lastName: "Connor",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    createdAt: "2023-06-10T08:00:00Z",
    lastLogin: new Date().toISOString(),
    twoFactorEnabled: true,
    verified: true,
  },
  hospital: {
    id: "USR-HOS-001",
    email: "admin@citygeneral.com",
    password: "Admin@1234",
    role: "hospital",
    hospitalName: "City General Hospital",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=CityGeneral",
    createdAt: "2022-03-01T00:00:00Z",
    lastLogin: new Date().toISOString(),
    twoFactorEnabled: true,
    verified: true,
  },
  admin: {
    id: "USR-ADM-001",
    email: "admin@medblock.io",
    password: "Admin@1234",
    role: "admin",
    firstName: "MedBlock",
    lastName: "Admin",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
    createdAt: "2022-01-01T00:00:00Z",
    lastLogin: new Date().toISOString(),
    twoFactorEnabled: true,
    verified: true,
  },
};

// =====================
// DEMO PATIENT PROFILES
// =====================

const DEMO_PATIENTS: PatientProfile[] = [
  {
    id: "PAT-001",
    userId: "USR-PAT-001",
    firstName: "John",
    lastName: "Doe",
    dob: "1990-05-12",
    gender: "male",
    bloodGroup: "O+",
    phone: "+1 (555) 234-5678",
    email: "john.doe@example.com",
    address: "123 Maple Street, New York, NY 10001",
    emergencyContact: { name: "Jane Doe", relation: "Spouse", phone: "+1 (555) 876-5432" },
    allergies: ["Penicillin", "Sulfa drugs"],
    chronicConditions: ["Hypertension", "Type 2 Diabetes"],
    insuranceProvider: "BlueCross BlueShield",
    insuranceId: "BCBS-29847361",
    ipfsHash: randomIpfsHash(),
    walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  },
  {
    id: "PAT-002",
    userId: "USR-PAT-002",
    firstName: "Emily",
    lastName: "Carter",
    dob: "1985-11-23",
    gender: "female",
    bloodGroup: "A+",
    phone: "+1 (555) 345-6789",
    email: "emily.carter@gmail.com",
    address: "456 Oak Avenue, Chicago, IL 60601",
    emergencyContact: { name: "Mark Carter", relation: "Brother", phone: "+1 (555) 765-4321" },
    allergies: ["Latex", "Aspirin"],
    chronicConditions: ["Asthma"],
    insuranceProvider: "Aetna",
    insuranceId: "AET-12345678",
    ipfsHash: randomIpfsHash(),
    walletAddress: null,
  },
  {
    id: "PAT-003",
    userId: "USR-PAT-003",
    firstName: "Robert",
    lastName: "Kim",
    dob: "1978-03-07",
    gender: "male",
    bloodGroup: "B-",
    phone: "+1 (555) 456-7890",
    email: "robert.kim@outlook.com",
    address: "789 Pine Road, Houston, TX 77001",
    emergencyContact: { name: "Lisa Kim", relation: "Wife", phone: "+1 (555) 654-3210" },
    allergies: [],
    chronicConditions: ["Chronic Back Pain", "Hypothyroidism"],
    insuranceProvider: "United Health",
    insuranceId: "UHC-98765432",
    ipfsHash: randomIpfsHash(),
    walletAddress: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
  },
  {
    id: "PAT-004",
    userId: "USR-PAT-004",
    firstName: "Sophia",
    lastName: "Martinez",
    dob: "1995-08-19",
    gender: "female",
    bloodGroup: "AB+",
    phone: "+1 (555) 567-8901",
    email: "sophia.m@example.com",
    address: "321 Elm Street, Los Angeles, CA 90001",
    emergencyContact: { name: "Carlos Martinez", relation: "Father", phone: "+1 (555) 543-2109" },
    allergies: ["Ibuprofen"],
    chronicConditions: [],
    insuranceProvider: "Cigna",
    insuranceId: "CGN-11223344",
    ipfsHash: randomIpfsHash(),
    walletAddress: null,
  },
  {
    id: "PAT-005",
    userId: "USR-PAT-005",
    firstName: "David",
    lastName: "Nguyen",
    dob: "1965-01-30",
    gender: "male",
    bloodGroup: "O-",
    phone: "+1 (555) 678-9012",
    email: "david.nguyen@yahoo.com",
    address: "654 Birch Lane, Seattle, WA 98101",
    emergencyContact: { name: "Mei Nguyen", relation: "Daughter", phone: "+1 (555) 432-1098" },
    allergies: ["Codeine", "Morphine"],
    chronicConditions: ["COPD", "Heart Disease"],
    insuranceProvider: "Medicare",
    insuranceId: "MCR-55667788",
    ipfsHash: randomIpfsHash(),
    walletAddress: "0x4B0897b0513fdC7C541B6d9D7E929C4e903be2b4",
  },
];

// =====================
// DEMO DOCTORS
// =====================

const DEMO_DOCTORS: DoctorProfile[] = [
  {
    id: "DOC-001",
    userId: "USR-DOC-001",
    firstName: "Sarah",
    lastName: "Connor",
    specialty: "Cardiology",
    licenseNumber: "MD-CA-19283",
    phone: "+1 (555) 100-2000",
    email: "dr.sarah.connor@citygeneral.com",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    experience: 14,
    rating: 4.9,
    totalPatients: 312,
    status: "active",
    availability: [
      { day: "Monday", slots: ["09:00", "10:00", "11:00", "14:00", "15:00"] },
      { day: "Wednesday", slots: ["09:00", "10:00", "11:00", "14:00"] },
      { day: "Friday", slots: ["10:00", "11:00", "15:00", "16:00"] },
    ],
    qualifications: ["MBBS - Harvard Medical School", "MD Cardiology - Johns Hopkins", "FACC - Fellow of ACC"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
  },
  {
    id: "DOC-002",
    userId: "USR-DOC-002",
    firstName: "James",
    lastName: "Patel",
    specialty: "Neurology",
    licenseNumber: "MD-NY-38471",
    phone: "+1 (555) 100-3000",
    email: "dr.james.patel@citygeneral.com",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    experience: 9,
    rating: 4.7,
    totalPatients: 198,
    status: "active",
    availability: [
      { day: "Tuesday", slots: ["08:00", "09:00", "10:00", "13:00"] },
      { day: "Thursday", slots: ["08:00", "09:00", "10:00", "14:00", "15:00"] },
    ],
    qualifications: ["MBBS - Stanford", "MD Neurology - UCSF", "Board Certified Neurologist"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
  },
  {
    id: "DOC-003",
    userId: "USR-DOC-003",
    firstName: "Priya",
    lastName: "Sharma",
    specialty: "Endocrinology",
    licenseNumber: "MD-TX-57392",
    phone: "+1 (555) 100-4000",
    email: "dr.priya.sharma@citygeneral.com",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    experience: 7,
    rating: 4.8,
    totalPatients: 145,
    status: "active",
    availability: [
      { day: "Monday", slots: ["12:00", "13:00", "14:00"] },
      { day: "Wednesday", slots: ["12:00", "13:00", "14:00", "15:00"] },
      { day: "Friday", slots: ["09:00", "10:00"] },
    ],
    qualifications: ["MBBS - Yale", "MD Endocrinology - Mayo Clinic", "Diabetes Specialist Certification"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
  },
  {
    id: "DOC-004",
    userId: "USR-DOC-004",
    firstName: "Marcus",
    lastName: "Webb",
    specialty: "Orthopedics",
    licenseNumber: "MD-FL-29183",
    phone: "+1 (555) 100-5000",
    email: "dr.marcus.webb@citygeneral.com",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    experience: 18,
    rating: 4.6,
    totalPatients: 489,
    status: "on-leave",
    availability: [],
    qualifications: ["MBBS - Duke", "MD Orthopedics - Hospital for Special Surgery", "Sports Medicine Certified"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus",
  },
  {
    id: "DOC-005",
    userId: "USR-DOC-005",
    firstName: "Aisha",
    lastName: "Thompson",
    specialty: "Psychiatry",
    licenseNumber: "MD-WA-64821",
    phone: "+1 (555) 100-6000",
    email: "dr.aisha.thompson@citygeneral.com",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    experience: 11,
    rating: 4.9,
    totalPatients: 267,
    status: "active",
    availability: [
      { day: "Monday", slots: ["09:00", "10:00", "11:00"] },
      { day: "Tuesday", slots: ["14:00", "15:00", "16:00"] },
      { day: "Thursday", slots: ["09:00", "10:00", "11:00", "14:00"] },
    ],
    qualifications: ["MBBS - Columbia", "MD Psychiatry - McLean Hospital", "Cognitive Behavioral Therapy Certified"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aisha",
  },
];

// =====================
// DEMO HEALTH RECORDS
// =====================

const DEMO_RECORDS: HealthRecord[] = [
  {
    id: "REC-001",
    patientId: "PAT-001",
    doctorId: "DOC-001",
    doctorName: "Dr. Sarah Connor",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    type: "lab",
    title: "Complete Blood Count (CBC)",
    description: "Routine blood panel to assess general health and detect disorders.",
    diagnosis: "Mild anemia detected",
    labResults: [
      { test: "Hemoglobin", value: "11.2", unit: "g/dL", normalRange: "13.5–17.5", status: "abnormal" },
      { test: "WBC Count", value: "7.2", unit: "K/uL", normalRange: "4.5–11.0", status: "normal" },
      { test: "Platelet Count", value: "245", unit: "K/uL", normalRange: "150–400", status: "normal" },
      { test: "Hematocrit", value: "33.5", unit: "%", normalRange: "41–53", status: "abnormal" },
    ],
    medications: [],
    date: daysAgo(5),
    status: "active",
    ipfsHash: randomIpfsHash(),
    blockchainTxHash: randomTxHash(),
    tags: ["routine", "blood", "anemia"],
    isShared: false,
    sharedWith: [],
  },
  {
    id: "REC-002",
    patientId: "PAT-001",
    doctorId: "DOC-001",
    doctorName: "Dr. Sarah Connor",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    type: "prescription",
    title: "Hypertension Management Prescription",
    description: "Monthly prescription for blood pressure control.",
    diagnosis: "Stage 1 Hypertension",
    medications: [
      { name: "Lisinopril", dosage: "10mg", frequency: "Once daily", duration: "30 days" },
      { name: "Amlodipine", dosage: "5mg", frequency: "Once daily", duration: "30 days" },
      { name: "Aspirin", dosage: "81mg", frequency: "Once daily", duration: "30 days" },
    ],
    date: daysAgo(12),
    status: "active",
    ipfsHash: randomIpfsHash(),
    blockchainTxHash: randomTxHash(),
    tags: ["hypertension", "chronic", "cardiology"],
    isShared: true,
    sharedWith: ["DOC-003"],
  },
  {
    id: "REC-003",
    patientId: "PAT-001",
    doctorId: "DOC-003",
    doctorName: "Dr. Priya Sharma",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    type: "lab",
    title: "HbA1c & Fasting Blood Glucose",
    description: "Diabetes monitoring panel — quarterly assessment.",
    labResults: [
      { test: "HbA1c", value: "7.4", unit: "%", normalRange: "<5.7", status: "critical" },
      { test: "Fasting Glucose", value: "148", unit: "mg/dL", normalRange: "70–100", status: "abnormal" },
      { test: "Insulin Level", value: "18", unit: "mIU/L", normalRange: "2.6–24.9", status: "normal" },
    ],
    date: daysAgo(20),
    status: "active",
    ipfsHash: randomIpfsHash(),
    blockchainTxHash: randomTxHash(),
    tags: ["diabetes", "hba1c", "quarterly"],
    isShared: false,
    sharedWith: [],
  },
  {
    id: "REC-004",
    patientId: "PAT-001",
    doctorId: "DOC-001",
    doctorName: "Dr. Sarah Connor",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    type: "imaging",
    title: "Chest X-Ray & ECG",
    description: "Cardiac screening as part of hypertension management protocol.",
    diagnosis: "Mild left ventricular hypertrophy suspected. Follow-up echocardiogram advised.",
    attachments: [
      { name: "chest_xray_frontal.dicom", ipfsHash: randomIpfsHash(), size: "4.2 MB" },
      { name: "ecg_12lead.pdf", ipfsHash: randomIpfsHash(), size: "1.1 MB" },
    ],
    date: daysAgo(35),
    status: "active",
    ipfsHash: randomIpfsHash(),
    blockchainTxHash: randomTxHash(),
    tags: ["cardiac", "imaging", "ecg", "xray"],
    isShared: false,
    sharedWith: [],
  },
  {
    id: "REC-005",
    patientId: "PAT-001",
    doctorId: "DOC-002",
    doctorName: "Dr. James Patel",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    type: "consultation",
    title: "Annual Physical Examination",
    description: "Comprehensive yearly checkup. Patient reports occasional headaches and fatigue.",
    diagnosis: "Fatigue attributed to poor sleep hygiene and anemia. Headaches likely tension-type.",
    medications: [
      { name: "Ferrous Sulfate", dosage: "325mg", frequency: "Twice daily with food", duration: "60 days" },
      { name: "Melatonin", dosage: "3mg", frequency: "Before bed", duration: "30 days" },
    ],
    date: daysAgo(60),
    status: "active",
    ipfsHash: randomIpfsHash(),
    blockchainTxHash: randomTxHash(),
    tags: ["annual", "checkup", "physical"],
    isShared: false,
    sharedWith: [],
  },
  {
    id: "REC-006",
    patientId: "PAT-001",
    doctorId: "DOC-001",
    doctorName: "Dr. Sarah Connor",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    type: "vaccination",
    title: "Influenza & Pneumococcal Vaccination",
    description: "Annual flu shot + pneumococcal vaccine (PCV15) per ACIP guidelines.",
    date: daysAgo(90),
    status: "archived",
    ipfsHash: randomIpfsHash(),
    blockchainTxHash: randomTxHash(),
    tags: ["vaccine", "flu", "preventive"],
    isShared: false,
    sharedWith: [],
  },
];

// =====================
// DEMO APPOINTMENTS
// =====================

const DEMO_APPOINTMENTS: Appointment[] = [
  {
    id: "APT-001",
    patientId: "PAT-001",
    patientName: "John Doe",
    doctorId: "DOC-001",
    doctorName: "Dr. Sarah Connor",
    doctorSpecialty: "Cardiology",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    date: daysFromNow(3),
    time: "10:00 AM",
    duration: 30,
    type: "in-person",
    status: "scheduled",
    reason: "Monthly blood pressure review and medication adjustment",
    createdAt: daysAgo(5),
  },
  {
    id: "APT-002",
    patientId: "PAT-001",
    patientName: "John Doe",
    doctorId: "DOC-003",
    doctorName: "Dr. Priya Sharma",
    doctorSpecialty: "Endocrinology",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    date: daysFromNow(10),
    time: "2:00 PM",
    duration: 45,
    type: "video",
    status: "scheduled",
    reason: "Quarterly HbA1c review and diabetes management plan update",
    createdAt: daysAgo(3),
  },
  {
    id: "APT-003",
    patientId: "PAT-001",
    patientName: "John Doe",
    doctorId: "DOC-002",
    doctorName: "Dr. James Patel",
    doctorSpecialty: "Neurology",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    date: daysAgo(15),
    time: "11:00 AM",
    duration: 60,
    type: "in-person",
    status: "completed",
    reason: "Recurring headaches — neurological evaluation",
    notes: "Tension headaches confirmed. No structural abnormality found. Advised stress management and physiotherapy.",
    prescription: "Naproxen 500mg PRN for pain relief. Max 2/day.",
    followUp: daysFromNow(30),
    createdAt: daysAgo(25),
  },
  {
    id: "APT-004",
    patientId: "PAT-002",
    patientName: "Emily Carter",
    doctorId: "DOC-001",
    doctorName: "Dr. Sarah Connor",
    doctorSpecialty: "Cardiology",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    date: today(),
    time: "9:00 AM",
    duration: 30,
    type: "in-person",
    status: "in-progress",
    reason: "Chest pain evaluation and cardiac risk assessment",
    createdAt: daysAgo(7),
  },
  {
    id: "APT-005",
    patientId: "PAT-003",
    patientName: "Robert Kim",
    doctorId: "DOC-002",
    doctorName: "Dr. James Patel",
    doctorSpecialty: "Neurology",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    date: today(),
    time: "11:00 AM",
    duration: 45,
    type: "video",
    status: "scheduled",
    reason: "Follow-up for chronic back pain and spinal assessment",
    createdAt: daysAgo(4),
  },
  {
    id: "APT-006",
    patientId: "PAT-004",
    patientName: "Sophia Martinez",
    doctorId: "DOC-005",
    doctorName: "Dr. Aisha Thompson",
    doctorSpecialty: "Psychiatry",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    date: daysFromNow(5),
    time: "3:00 PM",
    duration: 60,
    type: "video",
    status: "scheduled",
    reason: "Initial psychiatric evaluation — anxiety and stress management",
    createdAt: daysAgo(2),
  },
  {
    id: "APT-007",
    patientId: "PAT-005",
    patientName: "David Nguyen",
    doctorId: "DOC-001",
    doctorName: "Dr. Sarah Connor",
    doctorSpecialty: "Cardiology",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    date: daysAgo(8),
    time: "2:30 PM",
    duration: 60,
    type: "in-person",
    status: "cancelled",
    reason: "Heart disease management review",
    notes: "Patient cancelled — rescheduling pending.",
    createdAt: daysAgo(20),
  },
  {
    id: "APT-008",
    patientId: "PAT-001",
    patientName: "John Doe",
    doctorId: "DOC-001",
    doctorName: "Dr. Sarah Connor",
    doctorSpecialty: "Cardiology",
    hospitalId: "HOS-001",
    hospitalName: "City General Hospital",
    date: daysAgo(45),
    time: "10:00 AM",
    duration: 30,
    type: "in-person",
    status: "completed",
    reason: "Echocardiogram follow-up",
    notes: "Echo results within acceptable range. LVH not confirmed. Continue current medications.",
    prescription: "Continue Lisinopril 10mg + Amlodipine 5mg",
    createdAt: daysAgo(55),
  },
];

// =====================
// DEMO NOTIFICATIONS
// =====================

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "NOTIF-001",
    userId: "USR-PAT-001",
    title: "Appointment Reminder",
    message: `You have an appointment with Dr. Sarah Connor on ${daysFromNow(3)} at 10:00 AM.`,
    type: "info",
    read: false,
    createdAt: daysAgo(1),
    link: "/appointments/APT-001",
  },
  {
    id: "NOTIF-002",
    userId: "USR-PAT-001",
    title: "Lab Results Available",
    message: "Your CBC results are now available. Review them in My Records.",
    type: "success",
    read: false,
    createdAt: daysAgo(5),
    link: "/records/REC-001",
  },
  {
    id: "NOTIF-003",
    userId: "USR-PAT-001",
    title: "Prescription Renewal Due",
    message: "Your Lisinopril prescription expires in 7 days. Contact your doctor for renewal.",
    type: "warning",
    read: true,
    createdAt: daysAgo(8),
    link: "/records/REC-002",
  },
  {
    id: "NOTIF-004",
    userId: "USR-PAT-001",
    title: "Health Record Shared",
    message: "Dr. Sarah Connor has shared your prescription with Dr. Priya Sharma.",
    type: "info",
    read: true,
    createdAt: daysAgo(12),
  },
  {
    id: "NOTIF-005",
    userId: "USR-DOC-001",
    title: "New Patient Assigned",
    message: "Emily Carter has been assigned to your patient list.",
    type: "info",
    read: false,
    createdAt: daysAgo(1),
    link: "/patients/PAT-002",
  },
  {
    id: "NOTIF-006",
    userId: "USR-DOC-001",
    title: "Today's Schedule",
    message: "You have 3 appointments today starting at 9:00 AM.",
    type: "info",
    read: false,
    createdAt: today(),
  },
  {
    id: "NOTIF-007",
    userId: "USR-HOS-001",
    title: "Doctor On Leave",
    message: "Dr. Marcus Webb is on leave until further notice. Reassign his appointments.",
    type: "warning",
    read: false,
    createdAt: daysAgo(2),
  },
  {
    id: "NOTIF-008",
    userId: "USR-ADM-001",
    title: "Blockchain Sync Complete",
    message: "All records synced to block #18,452,109. IPFS nodes operational.",
    type: "success",
    read: false,
    createdAt: daysAgo(1),
  },
];

// =====================
// DEMO AUDIT LOGS
// =====================

const DEMO_AUDIT_LOGS: AuditLog[] = [
  { id: "LOG-001", userId: "USR-PAT-001", action: "VIEW_RECORD", resource: "HealthRecord", resourceId: "REC-001", ipAddress: "192.168.1.101", timestamp: new Date(Date.now() - 3600000).toISOString(), txHash: randomTxHash(), status: "success" },
  { id: "LOG-002", userId: "USR-DOC-001", action: "CREATE_RECORD", resource: "HealthRecord", resourceId: "REC-001", ipAddress: "10.0.0.52", timestamp: new Date(Date.now() - 7200000).toISOString(), txHash: randomTxHash(), status: "success" },
  { id: "LOG-003", userId: "USR-PAT-001", action: "LOGIN", resource: "Auth", resourceId: "USR-PAT-001", ipAddress: "192.168.1.101", timestamp: new Date(Date.now() - 10800000).toISOString(), status: "success" },
  { id: "LOG-004", userId: "USR-DOC-001", action: "SHARE_RECORD", resource: "HealthRecord", resourceId: "REC-002", ipAddress: "10.0.0.52", timestamp: new Date(Date.now() - 14400000).toISOString(), txHash: randomTxHash(), status: "success" },
  { id: "LOG-005", userId: "USR-HOS-001", action: "ADD_DOCTOR", resource: "DoctorProfile", resourceId: "DOC-005", ipAddress: "10.0.0.1", timestamp: new Date(Date.now() - 86400000).toISOString(), status: "success" },
  { id: "LOG-006", userId: "USR-ADM-001", action: "BLOCKCHAIN_SYNC", resource: "System", resourceId: "BLOCK-18452109", ipAddress: "10.0.0.1", timestamp: new Date(Date.now() - 3600000).toISOString(), txHash: randomTxHash(), status: "success" },
  { id: "LOG-007", userId: "USR-PAT-002", action: "LOGIN", resource: "Auth", resourceId: "USR-PAT-002", ipAddress: "172.16.0.5", timestamp: new Date(Date.now() - 5000000).toISOString(), status: "failed" },
  { id: "LOG-008", userId: "USR-DOC-003", action: "VIEW_PATIENT", resource: "PatientProfile", resourceId: "PAT-001", ipAddress: "10.0.0.55", timestamp: new Date(Date.now() - 21600000).toISOString(), status: "success" },
];

// =====================
// MUTABLE STORES
// =====================

const registeredUsers: Record<string, User> = {};
let _appointments = [...DEMO_APPOINTMENTS];
let _records = [...DEMO_RECORDS];
let _notifications = [...DEMO_NOTIFICATIONS];
let _auditLogs = [...DEMO_AUDIT_LOGS];

// =====================
// USER LOOKUP
// =====================

function findUser(email: string, password: string, role: UserRole): User | null {
  const demo = DEMO_USERS[role];
  if (demo && demo.email.toLowerCase() === email.toLowerCase() && demo.password === password) return demo;
  const key = `${email.toLowerCase()}:${role}`;
  const reg = registeredUsers[key];
  if (reg && reg.password === password) return reg;
  return null;
}

function findUserById(id: string): User | null {
  return Object.values(DEMO_USERS).find((u) => u.id === id) ||
    Object.values(registeredUsers).find((u) => u.id === id) || null;
}

// =====================
// PAGINATION HELPER
// =====================

function paginate<T>(items: T[], page = 1, limit = 10): { data: T[]; total: number; page: number; totalPages: number } {
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    total: items.length,
    page,
    totalPages: Math.ceil(items.length / limit),
  };
}

// =====================
// API
// =====================

export const api = {

  // =====================
  // GET
  // =====================

  async get(path: string, params?: Record<string, any>) {
    await delay();

    const p = params || {};
    const page = Number(p.page) || 1;
    const limit = Number(p.limit) || 10;

    // ─── PATIENTS ───────────────────────────────────────────

    if (path === "/patients") {
      let list = [...DEMO_PATIENTS];
      if (p.search) {
        const q = p.search.toLowerCase();
        list = list.filter((pt) =>
          `${pt.firstName} ${pt.lastName}`.toLowerCase().includes(q) ||
          pt.email.toLowerCase().includes(q) ||
          pt.id.toLowerCase().includes(q)
        );
      }
      if (p.bloodGroup) list = list.filter((pt) => pt.bloodGroup === p.bloodGroup);
      return paginate(list, page, limit);
    }

    if (path.startsWith("/patients/")) {
      const id = path.split("/")[2];
      const patient = DEMO_PATIENTS.find((pt) => pt.id === id);
      if (!patient) throw new Error("Patient not found.");
      return patient;
    }

    // ─── DOCTORS ────────────────────────────────────────────

    if (path === "/doctors") {
      let list = [...DEMO_DOCTORS];
      if (p.search) {
        const q = p.search.toLowerCase();
        list = list.filter((d) =>
          `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
          d.specialty.toLowerCase().includes(q) ||
          d.licenseNumber.toLowerCase().includes(q)
        );
      }
      if (p.specialty) list = list.filter((d) => d.specialty === p.specialty);
      if (p.status) list = list.filter((d) => d.status === p.status);
      return paginate(list, page, limit);
    }

    if (path.startsWith("/doctors/")) {
      const id = path.split("/")[2];
      const doctor = DEMO_DOCTORS.find((d) => d.id === id);
      if (!doctor) throw new Error("Doctor not found.");
      return doctor;
    }

    // ─── RECORDS ────────────────────────────────────────────

    if (path === "/records") {
      let list = [..._records];
      if (p.patientId) list = list.filter((r) => r.patientId === p.patientId);
      if (p.doctorId) list = list.filter((r) => r.doctorId === p.doctorId);
      if (p.type) list = list.filter((r) => r.type === p.type);
      if (p.status) list = list.filter((r) => r.status === p.status);
      if (p.search) {
        const q = p.search.toLowerCase();
        list = list.filter((r) =>
          r.title.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q)) ||
          r.doctorName.toLowerCase().includes(q)
        );
      }
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return paginate(list, page, limit);
    }

    if (path.startsWith("/records/")) {
      const id = path.split("/")[2];
      const record = _records.find((r) => r.id === id);
      if (!record) throw new Error("Record not found.");
      return record;
    }

    // ─── APPOINTMENTS ────────────────────────────────────────

    if (path === "/appointments") {
      let list = [..._appointments];
      if (p.patientId) list = list.filter((a) => a.patientId === p.patientId);
      if (p.doctorId) list = list.filter((a) => a.doctorId === p.doctorId);
      if (p.hospitalId) list = list.filter((a) => a.hospitalId === p.hospitalId);
      if (p.status) list = list.filter((a) => a.status === p.status);
      if (p.date) list = list.filter((a) => a.date === p.date);
      if (p.upcoming) list = list.filter((a) => new Date(a.date) >= new Date(today()) && a.status === "scheduled");
      if (p.today) list = list.filter((a) => a.date === today());
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return paginate(list, page, limit);
    }

    if (path.startsWith("/appointments/")) {
      const id = path.split("/")[2];
      const appt = _appointments.find((a) => a.id === id);
      if (!appt) throw new Error("Appointment not found.");
      return appt;
    }

    // ─── NOTIFICATIONS ───────────────────────────────────────

    if (path === "/notifications") {
      let list = _notifications.filter((n) => !p.userId || n.userId === p.userId);
      if (p.unread) list = list.filter((n) => !n.read);
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return paginate(list, page, limit);
    }

    // ─── AUDIT LOGS ──────────────────────────────────────────

    if (path === "/audit-logs") {
      let list = [..._auditLogs];
      if (p.userId) list = list.filter((l) => l.userId === p.userId);
      if (p.action) list = list.filter((l) => l.action === p.action);
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return paginate(list, page, limit);
    }

    // ─── STATS ───────────────────────────────────────────────

    if (path === "/stats/hospital") {
      const stats: HospitalStats = {
        totalDoctors: DEMO_DOCTORS.length,
        totalPatients: DEMO_PATIENTS.length,
        totalAppointments: _appointments.length,
        todayAppointments: _appointments.filter((a) => a.date === today()).length,
        pendingRecords: _records.filter((r) => r.status === "pending").length,
        revenue: [
          { month: "Jan", amount: 142000 },
          { month: "Feb", amount: 138000 },
          { month: "Mar", amount: 165000 },
          { month: "Apr", amount: 159000 },
          { month: "May", amount: 182000 },
          { month: "Jun", amount: 176000 },
          { month: "Jul", amount: 195000 },
          { month: "Aug", amount: 211000 },
          { month: "Sep", amount: 198000 },
          { month: "Oct", amount: 223000 },
          { month: "Nov", amount: 215000 },
          { month: "Dec", amount: 241000 },
        ],
        appointmentsByStatus: {
          scheduled: _appointments.filter((a) => a.status === "scheduled").length,
          completed: _appointments.filter((a) => a.status === "completed").length,
          cancelled: _appointments.filter((a) => a.status === "cancelled").length,
          "in-progress": _appointments.filter((a) => a.status === "in-progress").length,
        },
        recordsByType: {
          lab: _records.filter((r) => r.type === "lab").length,
          prescription: _records.filter((r) => r.type === "prescription").length,
          imaging: _records.filter((r) => r.type === "imaging").length,
          consultation: _records.filter((r) => r.type === "consultation").length,
          vaccination: _records.filter((r) => r.type === "vaccination").length,
          surgery: _records.filter((r) => r.type === "surgery").length,
        },
        recentActivity: _auditLogs.slice(0, 5),
      };
      return stats;
    }

    if (path === "/stats/patient") {
      const patientId = p.patientId || "PAT-001";
      const myRecords = _records.filter((r) => r.patientId === patientId);
      const myAppts = _appointments.filter((a) => a.patientId === patientId);
      const stats: PatientStats = {
        totalRecords: myRecords.length,
        totalAppointments: myAppts.length,
        upcomingAppointments: myAppts.filter((a) => new Date(a.date) >= new Date(today()) && a.status === "scheduled").length,
        totalDoctors: [...new Set(myRecords.map((r) => r.doctorId))].length,
        healthScore: 74,
        recordsByType: {
          lab: myRecords.filter((r) => r.type === "lab").length,
          prescription: myRecords.filter((r) => r.type === "prescription").length,
          imaging: myRecords.filter((r) => r.type === "imaging").length,
          consultation: myRecords.filter((r) => r.type === "consultation").length,
          vaccination: myRecords.filter((r) => r.type === "vaccination").length,
          surgery: myRecords.filter((r) => r.type === "surgery").length,
        },
        recentActivity: _auditLogs.filter((l) => l.userId === "USR-PAT-001").slice(0, 5),
      };
      return stats;
    }

    if (path === "/stats/doctor") {
      const doctorId = p.doctorId || "DOC-001";
      const myAppts = _appointments.filter((a) => a.doctorId === doctorId);
      const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId);
      const stats: DoctorStats = {
        totalPatients: doctor?.totalPatients || 0,
        todayAppointments: myAppts.filter((a) => a.date === today()).length,
        pendingReviews: _records.filter((r) => r.doctorId === doctorId && r.status === "pending").length,
        completedAppointments: myAppts.filter((a) => a.status === "completed").length,
        rating: doctor?.rating || 0,
        recentPatients: DEMO_PATIENTS.slice(0, 3),
        appointmentsByMonth: [
          { month: "Jul", count: 28 },
          { month: "Aug", count: 35 },
          { month: "Sep", count: 31 },
          { month: "Oct", count: 42 },
          { month: "Nov", count: 38 },
          { month: "Dec", count: 29 },
        ],
      };
      return stats;
    }

    if (path === "/stats/admin") {
      const stats: AdminStats = {
        totalUsers: Object.keys(DEMO_USERS).length + Object.keys(registeredUsers).length,
        totalHospitals: 1,
        totalDoctors: DEMO_DOCTORS.length,
        totalPatients: DEMO_PATIENTS.length,
        totalRecords: _records.length,
        blockchainSyncStatus: "synced",
        lastSyncBlock: 18452109,
        ipfsNodes: 7,
        systemHealth: [
          { service: "API Server", status: "up", latency: 42 },
          { service: "IPFS Gateway", status: "up", latency: 128 },
          { service: "Blockchain Node", status: "up", latency: 85 },
          { service: "Auth Service", status: "up", latency: 23 },
          { service: "Email Service", status: "degraded", latency: 320 },
          { service: "Database", status: "up", latency: 18 },
        ],
        recentAuditLogs: _auditLogs.slice(0, 10),
        userGrowth: [
          { month: "Jan", count: 120 },
          { month: "Feb", count: 145 },
          { month: "Mar", count: 178 },
          { month: "Apr", count: 201 },
          { month: "May", count: 243 },
          { month: "Jun", count: 289 },
          { month: "Jul", count: 334 },
          { month: "Aug", count: 378 },
          { month: "Sep", count: 412 },
          { month: "Oct", count: 456 },
          { month: "Nov", count: 498 },
          { month: "Dec", count: 541 },
        ],
      };
      return stats;
    }

    // ─── DOCTOR AVAILABILITY ─────────────────────────────────

    if (path.startsWith("/doctors/") && path.endsWith("/availability")) {
      const doctorId = path.split("/")[2];
      const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId);
      if (!doctor) throw new Error("Doctor not found.");
      return doctor.availability;
    }

    // ─── IPFS VERIFY ─────────────────────────────────────────

    if (path.startsWith("/ipfs/verify/")) {
      const hash = path.split("/")[3];
      return {
        hash,
        verified: true,
        pinnedAt: daysAgo(Math.floor(Math.random() * 60) + 1),
        size: `${(Math.random() * 5 + 0.5).toFixed(1)} MB`,
        replicationFactor: 3,
        nodes: ["ipfs-node-1.medblock.io", "ipfs-node-2.medblock.io", "ipfs-node-3.medblock.io"],
      };
    }

    // ─── BLOCKCHAIN TX ───────────────────────────────────────

    if (path.startsWith("/blockchain/tx/")) {
      const txHash = path.split("/")[3];
      return {
        txHash,
        blockNumber: 18452109 - Math.floor(Math.random() * 1000),
        confirmations: Math.floor(Math.random() * 50) + 12,
        timestamp: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
        gasUsed: Math.floor(Math.random() * 50000) + 21000,
        status: "confirmed",
        network: "Ethereum Mainnet",
      };
    }

    throw new Error(`Unknown GET endpoint: ${path}`);
  },

  // =====================
  // POST
  // =====================

  async post(path: string, body?: RequestBody) {
    await delay(1200);
    const data = body || {};

    // ─── LOGIN ───────────────────────────────────────────────

    if (path === "/auth/login") {
      const user = findUser(data.email, data.password, data.role);
      if (!user) throw new Error("Invalid credentials or incorrect role selected.");
      const updatedUser = { ...user, lastLogin: new Date().toISOString() };

      _auditLogs.unshift({
        id: `LOG-${uuid()}`,
        userId: user.id,
        action: "LOGIN",
        resource: "Auth",
        resourceId: user.id,
        ipAddress: "192.168.1." + Math.floor(Math.random() * 254 + 1),
        timestamp: new Date().toISOString(),
        status: "success",
      });

      return { token: generateToken(updatedUser), user: updatedUser };
    }

    // ─── WALLET LOGIN ────────────────────────────────────────

    if (path === "/auth/login/wallet") {
      const role = data.role as UserRole;
      const user = DEMO_USERS[role];
      if (!user) throw new Error("Invalid role.");
      if (!data.address) throw new Error("Wallet address is required.");
      if (user.address && user.address.toLowerCase() !== data.address.toLowerCase()) {
        throw new Error(`This wallet is not linked to a ${role} account.`);
      }
      return { token: generateToken(user), user };
    }

    // ─── PATIENT REGISTER ────────────────────────────────────

    if (path === "/auth/register") {
      const key = `${data.email.toLowerCase()}:patient`;
      if (registeredUsers[key]) throw new Error("An account with this email already exists.");
      if (!data.email || !data.password || !data.firstName || !data.lastName) {
        throw new Error("All fields are required.");
      }
      const newUser: User = {
        id: `USR-PAT-${uuid()}`,
        email: data.email,
        password: data.password,
        role: "patient",
        firstName: data.firstName,
        lastName: data.lastName,
        address: null,
        createdAt: new Date().toISOString(),
        verified: false,
        twoFactorEnabled: false,
      };
      registeredUsers[key] = newUser;
      return { token: generateToken(newUser), user: newUser };
    }

    // ─── HOSPITAL REGISTER ───────────────────────────────────

    if (path === "/auth/register-hospital") {
      const key = `${data.email.toLowerCase()}:hospital`;
      if (registeredUsers[key]) throw new Error("Hospital account already exists.");
      if (!data.email || !data.password || !data.hospitalName) {
        throw new Error("All fields are required.");
      }
      const newHospital: User = {
        id: `USR-HOS-${uuid()}`,
        email: data.email,
        password: data.password,
        role: "hospital",
        hospitalName: data.hospitalName,
        address: null,
        createdAt: new Date().toISOString(),
        verified: false,
        twoFactorEnabled: false,
      };
      registeredUsers[key] = newHospital;
      return { token: generateToken(newHospital), user: newHospital };
    }

    // ─── FORGOT PASSWORD ─────────────────────────────────────

    if (path === "/auth/forgot-password") {
      if (!data.email) throw new Error("Email is required.");
      return { message: "Password reset link sent to " + data.email, expiresIn: "15 minutes" };
    }

    // ─── RESET PASSWORD ──────────────────────────────────────

    if (path === "/auth/reset-password") {
      if (!data.token || !data.password) throw new Error("Token and new password are required.");
      return { message: "Password reset successfully. Please login with your new password." };
    }

    // ─── 2FA VERIFY ──────────────────────────────────────────

    if (path === "/auth/verify-2fa") {
      if (data.code !== "123456") throw new Error("Invalid 2FA code. Use 123456 for demo.");
      return { verified: true, message: "2FA verification successful." };
    }

    // ─── CREATE APPOINTMENT ──────────────────────────────────

    if (path === "/appointments") {
      if (!data.patientId || !data.doctorId || !data.date || !data.time) {
        throw new Error("patientId, doctorId, date, and time are required.");
      }
      const patient = DEMO_PATIENTS.find((pt) => pt.id === data.patientId);
      const doctor = DEMO_DOCTORS.find((d) => d.id === data.doctorId);
      if (!patient) throw new Error("Patient not found.");
      if (!doctor) throw new Error("Doctor not found.");
      if (doctor.status !== "active") throw new Error("Doctor is currently unavailable.");

      const newAppt: Appointment = {
        id: `APT-${uuid()}`,
        patientId: data.patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        doctorId: data.doctorId,
        doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        doctorSpecialty: doctor.specialty,
        hospitalId: doctor.hospitalId,
        hospitalName: doctor.hospitalName,
        date: data.date,
        time: data.time,
        duration: data.duration || 30,
        type: data.type || "in-person",
        status: "scheduled",
        reason: data.reason || "General consultation",
        notes: data.notes,
        createdAt: new Date().toISOString(),
      };
      _appointments.push(newAppt);
      return newAppt;
    }

    // ─── CREATE HEALTH RECORD ────────────────────────────────

    if (path === "/records") {
      if (!data.patientId || !data.type || !data.title) {
        throw new Error("patientId, type, and title are required.");
      }
      const patient = DEMO_PATIENTS.find((pt) => pt.id === data.patientId);
      const doctor = DEMO_DOCTORS.find((d) => d.id === data.doctorId) || DEMO_DOCTORS[0];
      if (!patient) throw new Error("Patient not found.");

      const newRecord: HealthRecord = {
        id: `REC-${uuid()}`,
        patientId: data.patientId,
        doctorId: doctor.id,
        doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        hospitalId: doctor.hospitalId,
        hospitalName: doctor.hospitalName,
        type: data.type,
        title: data.title,
        description: data.description || "",
        diagnosis: data.diagnosis,
        medications: data.medications || [],
        labResults: data.labResults || [],
        attachments: data.attachments || [],
        date: today(),
        status: "active",
        ipfsHash: randomIpfsHash(),
        blockchainTxHash: randomTxHash(),
        tags: data.tags || [],
        isShared: false,
        sharedWith: [],
      };
      _records.push(newRecord);

      _auditLogs.unshift({
        id: `LOG-${uuid()}`,
        userId: doctor.userId,
        action: "CREATE_RECORD",
        resource: "HealthRecord",
        resourceId: newRecord.id,
        ipAddress: "10.0.0.52",
        timestamp: new Date().toISOString(),
        txHash: newRecord.blockchainTxHash,
        status: "success",
      });

      return newRecord;
    }

    // ─── SHARE RECORD ────────────────────────────────────────

    if (path.startsWith("/records/") && path.endsWith("/share")) {
      const id = path.split("/")[2];
      const record = _records.find((r) => r.id === id);
      if (!record) throw new Error("Record not found.");
      if (!data.doctorIds || !Array.isArray(data.doctorIds)) throw new Error("doctorIds array required.");
      record.isShared = true;
      record.sharedWith = [...new Set([...record.sharedWith, ...data.doctorIds])];
      return record;
    }

    // ─── MARK NOTIFICATION READ ──────────────────────────────

    if (path.startsWith("/notifications/") && path.endsWith("/read")) {
      const id = path.split("/")[2];
      const notif = _notifications.find((n) => n.id === id);
      if (!notif) throw new Error("Notification not found.");
      notif.read = true;
      return notif;
    }

    // ─── MARK ALL NOTIFICATIONS READ ─────────────────────────

    if (path === "/notifications/read-all") {
      const userId = data.userId;
      _notifications.forEach((n) => { if (!userId || n.userId === userId) n.read = true; });
      return { message: "All notifications marked as read." };
    }

    // ─── ADD DOCTOR (hospital) ───────────────────────────────

    if (path === "/doctors") {
      if (!data.firstName || !data.lastName || !data.specialty || !data.email) {
        throw new Error("firstName, lastName, specialty, and email are required.");
      }
      const newDoctor: DoctorProfile = {
        id: `DOC-${uuid()}`,
        userId: `USR-DOC-${uuid()}`,
        firstName: data.firstName,
        lastName: data.lastName,
        specialty: data.specialty,
        licenseNumber: data.licenseNumber || `MD-XX-${uuid()}`,
        phone: data.phone || "",
        email: data.email,
        hospitalId: data.hospitalId || "HOS-001",
        hospitalName: data.hospitalName || "City General Hospital",
        experience: data.experience || 0,
        rating: 0,
        totalPatients: 0,
        status: "active",
        availability: data.availability || [],
        qualifications: data.qualifications || [],
      };
      DEMO_DOCTORS.push(newDoctor);
      return newDoctor;
    }

    // ─── IPFS UPLOAD ─────────────────────────────────────────

    if (path === "/ipfs/upload") {
      await delay(800);
      return {
        ipfsHash: randomIpfsHash(),
        size: data.size || "unknown",
        uploadedAt: new Date().toISOString(),
        pinned: true,
      };
    }

    throw new Error(`Unknown POST endpoint: ${path}`);
  },

  // =====================
  // PUT / PATCH
  // =====================

  async put(path: string, body?: RequestBody) {
    await delay();
    const data = body || {};

    // ─── UPDATE APPOINTMENT ──────────────────────────────────

    if (path.startsWith("/appointments/")) {
      const id = path.split("/")[2];
      const idx = _appointments.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error("Appointment not found.");
      _appointments[idx] = { ..._appointments[idx], ...data, id };
      return _appointments[idx];
    }

    // ─── UPDATE RECORD ───────────────────────────────────────

    if (path.startsWith("/records/")) {
      const id = path.split("/")[2];
      const idx = _records.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error("Record not found.");
      _records[idx] = { ..._records[idx], ...data, id };
      return _records[idx];
    }

    // ─── UPDATE PATIENT PROFILE ──────────────────────────────

    if (path.startsWith("/patients/")) {
      const id = path.split("/")[2];
      const idx = DEMO_PATIENTS.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error("Patient not found.");
      Object.assign(DEMO_PATIENTS[idx], data);
      return DEMO_PATIENTS[idx];
    }

    // ─── UPDATE DOCTOR ───────────────────────────────────────

    if (path.startsWith("/doctors/")) {
      const id = path.split("/")[2];
      const idx = DEMO_DOCTORS.findIndex((d) => d.id === id);
      if (idx === -1) throw new Error("Doctor not found.");
      Object.assign(DEMO_DOCTORS[idx], data);
      return DEMO_DOCTORS[idx];
    }

    // ─── LINK WALLET ─────────────────────────────────────────

    if (path.startsWith("/users/") && path.endsWith("/wallet")) {
      const userId = path.split("/")[2];
      const user = findUserById(userId);
      if (!user) throw new Error("User not found.");
      if (!data.address) throw new Error("Wallet address is required.");
      user.address = data.address;
      return { message: "Wallet linked successfully.", address: data.address };
    }

    throw new Error(`Unknown PUT endpoint: ${path}`);
  },

  // =====================
  // DELETE
  // =====================

  async delete(path: string) {
    await delay(700);

    // ─── CANCEL APPOINTMENT ──────────────────────────────────

    if (path.startsWith("/appointments/")) {
      const id = path.split("/")[2];
      const appt = _appointments.find((a) => a.id === id);
      if (!appt) throw new Error("Appointment not found.");
      if (appt.status === "completed") throw new Error("Cannot cancel a completed appointment.");
      appt.status = "cancelled";
      return { message: "Appointment cancelled successfully.", id };
    }

    // ─── ARCHIVE RECORD ──────────────────────────────────────

    if (path.startsWith("/records/")) {
      const id = path.split("/")[2];
      const record = _records.find((r) => r.id === id);
      if (!record) throw new Error("Record not found.");
      record.status = "archived";
      return { message: "Record archived successfully.", id };
    }

    // ─── DEACTIVATE DOCTOR ───────────────────────────────────

    if (path.startsWith("/doctors/")) {
      const id = path.split("/")[2];
      const doctor = DEMO_DOCTORS.find((d) => d.id === id);
      if (!doctor) throw new Error("Doctor not found.");
      doctor.status = "inactive";
      return { message: "Doctor deactivated.", id };
    }

    throw new Error(`Unknown DELETE endpoint: ${path}`);
  },
};

// =====================
// SESSION MANAGEMENT
// =====================

const TOKEN_KEY = "mb_token";
const USER_KEY = "mb_user";

export function saveSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  return { token, user: user ? JSON.parse(user) : null };
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): User | null {
  const user = localStorage.getItem(USER_KEY);
  if (!user) return null;
  return JSON.parse(user);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// =====================
// TYPED CONVENIENCE HOOKS
// =====================

// Decodes the JWT-like token and returns the payload
export function decodeToken(token: string): { id: string; email: string; role: UserRole; timestamp: number } | null {
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

// Returns true if a session token is still "fresh" (under 8 hours)
export function isSessionValid(): boolean {
  const token = getAuthToken();
  if (!token) return false;
  const decoded = decodeToken(token);
  if (!decoded) return false;
  const eightHours = 8 * 60 * 60 * 1000;
  return Date.now() - decoded.timestamp < eightHours;
}