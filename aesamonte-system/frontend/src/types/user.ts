export interface UserPermissions {
  sales: boolean;
  inventory: boolean;
  orders: boolean;
  suppliers: boolean;
  reports: boolean;
  settings: boolean;
}

export interface UserInfo {
  employeeId: number;
  roleName: string;
  employeeName: string;
  permissions: UserPermissions;
  token: string;
}
