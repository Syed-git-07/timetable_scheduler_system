import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token to every request
API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors globally
API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──
export const login = (data) => API.post('/auth/login', data);
export const forgotPassword = (data) => API.post('/auth/forgot-password', data);
export const getMe = () => API.get('/auth/me');
export const registerUser = (data) => API.post('/auth/register', data);

// ── Departments ──
export const getDepartments = () => API.get('/departments');
export const createDepartment = (data) => API.post('/departments', data);
export const updateDepartment = (id, data) => API.put(`/departments/${id}`, data);
export const deleteDepartment = (id) => API.delete(`/departments/${id}`);

// ── Subjects ──
export const getSubjects = (params) => API.get('/subjects', { params });
export const createSubject = (data) => API.post('/subjects', data);
export const updateSubject = (id, data) => API.put(`/subjects/${id}`, data);
export const deleteSubject = (id) => API.delete(`/subjects/${id}`);

// ── Teachers ──
export const getTeachers = (params) => API.get('/teachers', { params });
export const createTeacher = (data) => API.post('/teachers', data);
export const updateTeacher = (id, data) => API.put(`/teachers/${id}`, data);
export const toggleTeacher = (id) => API.patch(`/teachers/${id}/toggle`);
export const deleteTeacher = (id) => API.delete(`/teachers/${id}`);

// ── Rooms ──
export const getRooms = (params) => API.get('/rooms', { params });
export const createRoom = (data) => API.post('/rooms', data);
export const updateRoom = (id, data) => API.put(`/rooms/${id}`, data);
export const toggleRoom = (id) => API.patch(`/rooms/${id}/toggle`);
export const deleteRoom = (id) => API.delete(`/rooms/${id}`);

// ── TimeSlots ──
export const getTimeSlots = () => API.get('/timeslots');
export const createTimeSlot = (data) => API.post('/timeslots', data);
export const seedTimeSlots = () => API.post('/timeslots/seed');
export const clearTimeSlots = () => API.delete('/timeslots/clear');
export const deleteTimeSlot = (id) => API.delete(`/timeslots/${id}`);

// ── Classes ──
export const getClasses = (params) => API.get('/classes', { params });
export const createClass = (data) => API.post('/classes', data);
export const updateClass = (id, data) => API.put(`/classes/${id}`, data);
export const deleteClass = (id) => API.delete(`/classes/${id}`);

// ── Timetable ──
export const getTimetableEntries = (params) => API.get('/timetable/entries', { params });
export const getTimetableStats = () => API.get('/timetable/stats');
export const generateTimetable = (data) => API.post('/timetable/generate', data);
export const generateAllTimetables = () => API.post('/timetable/generate-all');
export const substituteTeacher = (data) => API.post('/timetable/substitute', data);
export const repairTimetable = () => API.post('/timetable/repair');
export const updateTimetableEntry = (id, data) => API.put(`/timetable/update/${id}`, data);
export const addCustomEntry = (data) => API.post('/timetable/add-custom', data);
export const deleteEntry = (id) => API.delete(`/timetable/${id}`);
export const clearAllTimetable = () => API.delete('/timetable/clear/all');
export const clearClassTimetable = (id) => API.delete(`/timetable/clear/class/${id}`);

export default API;
