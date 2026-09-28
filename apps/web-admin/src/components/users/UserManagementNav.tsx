import { NavLink } from "react-router-dom";

const USER_MANAGEMENT_LINKS = [
  { to: "/users", label: "المستخدمون", end: true },
  { to: "/roles-permissions", label: "الأدوار والصلاحيات", end: false },
  { to: "/sessions", label: "الجلسات", end: false },
  { to: "/administrators", label: "المشرفون", end: false },
  { to: "/audit", label: "سجل التدقيق", end: false },
  { to: "/features", label: "ميزات المستخدمين", end: false },
] as const;

export function UserManagementNav() {
  return (
    <nav className="user-management-nav" aria-label="التنقل في إدارة المستخدمين">
      {USER_MANAGEMENT_LINKS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `user-management-nav-item${isActive ? " active" : ""}`}>
          {item.label}
        </NavLink>
      ))}
      <a className="user-management-nav-item" href="#bulk-operations">الإدارة الجماعية</a>
    </nav>
  );
}
