import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, Users, BookOpen, Building2, Clock,
  CalendarDays, GraduationCap, School, LogOut, ChevronRight,
  Sun, Moon, Settings, User, Shield, ChevronUp
} from 'lucide-react';

const adminLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/departments', icon: School, label: 'Departments' },
  { to: '/classes', icon: GraduationCap, label: 'Classes' },
  { to: '/subjects', icon: BookOpen, label: 'Subjects' },
  { to: '/teachers', icon: Users, label: 'Teachers' },
  { to: '/rooms', icon: Building2, label: 'Rooms' },
  { to: '/timeslots', icon: Clock, label: 'Time Slots' },
  { to: '/timetable', icon: CalendarDays, label: 'Timetable' },
];

const studentLinks = [
  { to: '/student', icon: CalendarDays, label: 'View Timetable' },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const links = user?.role === 'ADMIN' ? adminLinks : studentLinks;
  const initials = (user?.fullName || user?.username || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = () => {
    setProfileOpen(false);
    signOut();
    navigate('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">🗓️</div>
        <h2>TimeTable Pro</h2>
        <span>College Scheduler</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <span className="nav-section-label">
          {user?.role === 'ADMIN' ? 'Administration' : 'Student Portal'}
        </span>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Profile Section */}
      <div className="sidebar-footer" ref={dropdownRef}>
        {/* Profile Dropdown */}
        {profileOpen && (
          <div className="profile-dropdown">
            {/* User info header */}
            <div className="profile-dropdown-header">
              <div className="profile-dropdown-avatar">{initials}</div>
              <div className="profile-dropdown-info">
                <div className="profile-dropdown-name">{user?.fullName || user?.username}</div>
                <div className="profile-dropdown-email">{user?.email || user?.username}</div>
              </div>
            </div>

            <div className="profile-dropdown-divider" />

            {/* Role badge */}
            <div className="profile-dropdown-item profile-dropdown-item--static">
              {user?.role === 'ADMIN' ? <Shield size={15} /> : <User size={15} />}
              <span>{user?.role === 'ADMIN' ? 'Administrator' : 'Student'}</span>
              <span className={`role-badge ${user?.role === 'ADMIN' ? 'role-badge--admin' : 'role-badge--student'}`}>
                {user?.role}
              </span>
            </div>

            <div className="profile-dropdown-divider" />

            {/* Theme toggle */}
            <button className="profile-dropdown-item" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              <div className={`theme-toggle-pill ${theme === 'light' ? 'theme-toggle-pill--active' : ''}`}>
                <div className="theme-toggle-knob" />
              </div>
            </button>

            <div className="profile-dropdown-divider" />

            {/* Logout */}
            <button className="profile-dropdown-item profile-dropdown-item--danger" onClick={handleLogout}>
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* User pill — clickable */}
        <button
          className={`user-pill ${profileOpen ? 'user-pill--active' : ''}`}
          onClick={() => setProfileOpen(p => !p)}
          aria-expanded={profileOpen}
          aria-label="User profile menu"
        >
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="name">{user?.fullName || user?.username}</div>
            <div className="role">{user?.role}</div>
          </div>
          <ChevronUp
            size={14}
            className="user-pill-chevron"
            style={{ transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      </div>
    </aside>
  );
}
