import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getTimetableStats, getClasses, getTeachers, generateTimetable, generateAllTimetables,
  substituteTeacher, repairTimetable, clearAllTimetable, getTimetableEntries,
  getDepartments, getSubjects, getRooms, getTimeSlots
} from '../api/api';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import {
  Users, BookOpen, Building2, Clock, CalendarDays, School, GraduationCap,
  Zap, Wand2, RefreshCw, Trash2, UserX, Wrench, AlertTriangle, Layers,
  CheckCircle2, AlertCircle, Info, Activity, Calendar, BadgeAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [entries, setEntries] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState('');

  // Generate modal state
  const [genModal, setGenModal] = useState(false);
  const [genClass, setGenClass] = useState('');
  const [genLoading, setGenLoading] = useState(false);

  // Substitute modal state
  const [subModal, setSubModal] = useState(false);
  const [absentId, setAbsentId] = useState('');
  const [subId, setSubId] = useState('');
  const [subLoading, setSubLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [
        statsRes,
        deptsRes,
        classesRes,
        teachersRes,
        subjectsRes,
        roomsRes,
        slotsRes,
        entriesRes
      ] = await Promise.all([
        getTimetableStats(),
        getDepartments(),
        getClasses(),
        getTeachers(),
        getSubjects(),
        getRooms(),
        getTimeSlots(),
        getTimetableEntries()
      ]);
      setStats(statsRes.data);
      setDepartments(deptsRes.data);
      setClasses(classesRes.data);
      setTeachers(teachersRes.data);
      setSubjects(subjectsRes.data);
      setRooms(roomsRes.data);
      setTimeSlots(slotsRes.data);
      setEntries(entriesRes.data);
    } catch (e) {
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Set default selected day
  useEffect(() => {
    if (timeSlots.length > 0) {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = daysOfWeek[new Date().getDay()];
      const uniqueDays = Array.from(new Set(timeSlots.map(s => s.dayOfWeek)));
      if (uniqueDays.includes(todayName)) {
        setSelectedDay(todayName);
      } else if (uniqueDays.length > 0) {
        setSelectedDay(uniqueDays[0]);
      } else {
        setSelectedDay('Monday');
      }
    }
  }, [timeSlots]);

  // Handle Quick Actions
  const handleGenerate = async () => {
    if (!genClass) return toast.error('Select a class first.');
    setGenLoading(true);
    try {
      const res = await generateTimetable({ classSectionId: genClass });
      toast.success(res.data.message);
      setGenModal(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Generation failed.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleSubstitute = async () => {
    if (!absentId || !subId) return toast.error('Select both teachers.');
    setSubLoading(true);
    try {
      const res = await substituteTeacher({ absentTeacherId: absentId, substituteTeacherId: subId });
      toast.success(res.data.message);
      setSubModal(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Substitution failed.');
    } finally {
      setSubLoading(false);
    }
  };

  const handleRepair = async () => {
    if (!confirm('Run the 5-strategy repair algorithm? This will auto-fix conflicts.')) return;
    try {
      const res = await repairTimetable();
      toast.success(res.data.message || 'Repair completed successfully.');
      load();
    } catch (e) {
      toast.error('Repair failed.');
    }
  };

  const handleGenerateAll = async () => {
    if (!confirm('Generate timetables for ALL class sections? Existing entries will be replaced.')) return;
    toast.promise(
      generateAllTimetables().then(r => { load(); return r; }),
      {
        loading: 'Generating timetables for all classes…',
        success: r => r.data.message,
        error: e => e.response?.data?.message || 'Generation failed.'
      }
    );
  };

  const handleClearAll = async () => {
    if (!confirm('Clear the ENTIRE timetable? This cannot be undone.')) return;
    try {
      const res = await clearAllTimetable();
      toast.success(res.data.message);
      load();
    } catch (e) {
      toast.error('Failed to clear timetable.');
    }
  };

  // derived calculations via useMemo
  const targetPeriodsMap = useMemo(() => {
    const map = {};
    classes.forEach(c => {
      const deptId = c.department?._id || c.department;
      const semester = c.semester;
      if (!deptId) {
        map[c._id] = 0;
        return;
      }
      const matchedSubjects = subjects.filter(s => {
        const sDeptId = s.department?._id || s.department;
        return sDeptId && sDeptId.toString() === deptId.toString() && s.semester === semester;
      });
      map[c._id] = matchedSubjects.reduce((sum, s) => sum + (s.periodsPerWeek || 1), 0);
    });
    return map;
  }, [classes, subjects]);

  const scheduledPeriodsMap = useMemo(() => {
    const map = {};
    classes.forEach(c => {
      map[c._id] = 0;
    });
    entries.forEach(e => {
      const cId = e.classSection?._id || e.classSection;
      if (cId) {
        map[cId] = (map[cId] || 0) + 1;
      }
    });
    return map;
  }, [classes, entries]);

  const statsSummary = useMemo(() => {
    let totalTarget = 0;
    let totalScheduled = 0;
    classes.forEach(c => {
      totalTarget += (targetPeriodsMap[c._id] || 0);
      totalScheduled += (scheduledPeriodsMap[c._id] || 0);
    });
    const allocationRate = totalTarget > 0 ? Math.round((totalScheduled / totalTarget) * 100) : 0;

    const scheduledClassesCount = classes.filter(c => (scheduledPeriodsMap[c._id] || 0) > 0).length;
    const activeTeachersCount = teachers.filter(t => t.available).length;
    const activeRoomsCount = rooms.filter(r => r.available).length;

    return {
      totalTarget,
      totalScheduled,
      allocationRate,
      scheduledClassesCount,
      activeTeachersCount,
      activeRoomsCount
    };
  }, [classes, teachers, rooms, targetPeriodsMap, scheduledPeriodsMap]);

  const deptBreakdowns = useMemo(() => {
    return departments.map(d => {
      const deptClasses = classes.filter(c => {
        const cDeptId = c.department?._id || c.department;
        return cDeptId && cDeptId.toString() === d._id.toString();
      });
      const deptTeachers = teachers.filter(t => {
        const tDeptId = t.department?._id || t.department;
        return tDeptId && tDeptId.toString() === d._id.toString();
      });
      const deptRooms = rooms.filter(r => {
        const rDeptId = r.department?._id || r.department;
        return rDeptId && rDeptId.toString() === d._id.toString();
      });

      let deptTarget = 0;
      let deptScheduled = 0;
      deptClasses.forEach(c => {
        deptTarget += (targetPeriodsMap[c._id] || 0);
        deptScheduled += (scheduledPeriodsMap[c._id] || 0);
      });

      const coverage = deptTarget > 0 ? Math.round((deptScheduled / deptTarget) * 100) : 0;

      return {
        ...d,
        classesCount: deptClasses.length,
        teachersCount: deptTeachers.length,
        roomsCount: deptRooms.length,
        targetPeriods: deptTarget,
        scheduledPeriods: deptScheduled,
        coverage
      };
    });
  }, [departments, classes, teachers, rooms, targetPeriodsMap, scheduledPeriodsMap]);

  const teacherWorkloads = useMemo(() => {
    const map = {};
    teachers.forEach(t => {
      map[t._id] = 0;
    });
    entries.forEach(e => {
      const tId = e.teacher?._id || e.teacher;
      if (tId) {
        map[tId] = (map[tId] || 0) + 1;
      }
    });

    return teachers.map(t => {
      const count = map[t._id] || 0;
      let status = 'Optimal';
      let badgeClass = 'badge-green';
      if (count === 0) {
        status = 'Idle';
        badgeClass = 'badge-gray';
      } else if (count <= 6) {
        status = 'Underutilized';
        badgeClass = 'badge-indigo';
      } else if (count > 15) {
        status = 'Heavy Workload';
        badgeClass = 'badge-rose';
      }
      return {
        ...t,
        periodsCount: count,
        status,
        badgeClass
      };
    });
  }, [teachers, entries]);

  const conflictsList = useMemo(() => {
    const list = [];

    // 1. Double booked teachers (teacher at slot)
    const teacherSlotGroup = {};
    entries.forEach(e => {
      const tId = e.teacher?._id || e.teacher;
      const slotId = e.timeSlot?._id || e.timeSlot;
      if (tId && slotId) {
        const key = `${tId}_${slotId}`;
        if (!teacherSlotGroup[key]) {
          teacherSlotGroup[key] = [];
        }
        teacherSlotGroup[key].push(e);
      }
    });

    Object.keys(teacherSlotGroup).forEach(key => {
      const group = teacherSlotGroup[key];
      if (group.length > 1) {
        const teacherName = group[0].teacher?.name || 'Unknown Teacher';
        const day = group[0].timeSlot?.dayOfWeek || 'Unknown Day';
        const time = group[0].timeSlot?.startTime || 'Unknown Time';
        const classesList = group.map(g => g.classSection?.name || 'Class').join(', ');
        list.push({
          type: 'Teacher Conflict',
          message: `${teacherName} is scheduled in multiple classes at ${time} on ${day} (${classesList}).`,
          severity: 'danger'
        });
      }
    });

    // 2. Double booked rooms (room at slot)
    const roomSlotGroup = {};
    entries.forEach(e => {
      const roomId = e.room?._id || e.room;
      const slotId = e.timeSlot?._id || e.timeSlot;
      if (roomId && slotId) {
        const key = `${roomId}_${slotId}`;
        if (!roomSlotGroup[key]) {
          roomSlotGroup[key] = [];
        }
        roomSlotGroup[key].push(e);
      }
    });

    Object.keys(roomSlotGroup).forEach(key => {
      const group = roomSlotGroup[key];
      if (group.length > 1) {
        const roomNum = group[0].room?.roomNumber || 'Room';
        const day = group[0].timeSlot?.dayOfWeek || 'Unknown Day';
        const time = group[0].timeSlot?.startTime || 'Unknown Time';
        const classesList = group.map(g => g.classSection?.name || 'Class').join(', ');
        list.push({
          type: 'Room Conflict',
          message: `Room ${roomNum} is occupied by multiple classes at ${time} on ${day} (${classesList}).`,
          severity: 'danger'
        });
      }
    });

    // 3. Double booked classes (class at slot)
    const classSlotGroup = {};
    entries.forEach(e => {
      const cId = e.classSection?._id || e.classSection;
      const slotId = e.timeSlot?._id || e.timeSlot;
      if (cId && slotId) {
        const key = `${cId}_${slotId}`;
        if (!classSlotGroup[key]) {
          classSlotGroup[key] = [];
        }
        classSlotGroup[key].push(e);
      }
    });

    Object.keys(classSlotGroup).forEach(key => {
      const group = classSlotGroup[key];
      if (group.length > 1) {
        const className = group[0].classSection?.name || 'Class';
        const day = group[0].timeSlot?.dayOfWeek || 'Unknown Day';
        const time = group[0].timeSlot?.startTime || 'Unknown Time';
        const subjectsList = group.map(g => g.subject?.name || 'Subject').join(', ');
        list.push({
          type: 'Class Conflict',
          message: `Class ${className} has multiple periods scheduled at ${time} on ${day} (${subjectsList}).`,
          severity: 'danger'
        });
      }
    });

    // 4. Classes missing schedule entirely
    classes.forEach(c => {
      const scheduledCount = scheduledPeriodsMap[c._id] || 0;
      const targetCount = targetPeriodsMap[c._id] || 0;
      if (scheduledCount === 0) {
        list.push({
          type: 'Unscheduled Class',
          message: `Class ${c.name} has no periods scheduled in the system.`,
          severity: 'warning'
        });
      } else if (scheduledCount < targetCount) {
        list.push({
          type: 'Under-scheduled Class',
          message: `Class ${c.name} only has ${scheduledCount}/${targetCount} periods scheduled.`,
          severity: 'info'
        });
      }
    });

    // 5. Unassigned Subjects
    const handledSubjectIds = new Set();
    teachers.forEach(t => {
      const sId = t.handledSubject?._id || t.handledSubject;
      if (sId) handledSubjectIds.add(sId.toString());
    });

    subjects.forEach(s => {
      if (!handledSubjectIds.has(s._id.toString())) {
        list.push({
          type: 'Unallocated Subject',
          message: `Subject ${s.name} (${s.code}) has no teacher assigned in the department.`,
          severity: 'warning'
        });
      }
    });

    return list;
  }, [classes, teachers, subjects, entries, targetPeriodsMap, scheduledPeriodsMap]);

  // Filter day slots & entries
  const daySlots = useMemo(() => {
    return timeSlots
      .filter(s => s.dayOfWeek === selectedDay)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [timeSlots, selectedDay]);

  const dayEntriesGrouped = useMemo(() => {
    const group = {};
    const filtered = entries.filter(e => e.timeSlot?.dayOfWeek === selectedDay);
    filtered.forEach(e => {
      const slotId = e.timeSlot?._id || e.timeSlot;
      if (slotId) {
        if (!group[slotId]) group[slotId] = [];
        group[slotId].push(e);
      }
    });
    return group;
  }, [entries, selectedDay]);

  const uniqueDays = useMemo(() => {
    const days = Array.from(new Set(timeSlots.map(s => s.dayOfWeek)));
    const order = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
    return days.sort((a, b) => (order[a] || 8) - (order[b] || 8));
  }, [timeSlots]);

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Loading dashboard…</p>
    </div>
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Dashboard</h1>
          <p>College timetable scheduling coverage & operational health check</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => load()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <StatCard 
          label="Coverage Rate" 
          value={`${statsSummary.allocationRate}%`} 
          icon={Activity} 
          color="#8b5cf6" 
          colorRgb="139,92,246" 
        />
        <StatCard 
          label="Scheduled Classes" 
          value={`${statsSummary.scheduledClassesCount}/${classes.length}`} 
          icon={GraduationCap} 
          color="#06b6d4" 
          colorRgb="6,182,212" 
        />
        <StatCard 
          label="Active Teachers" 
          value={`${statsSummary.activeTeachersCount}/${teachers.length}`} 
          icon={Users} 
          color="#10b981" 
          colorRgb="16,185,129" 
        />
        <StatCard 
          label="Active Rooms" 
          value={`${statsSummary.activeRoomsCount}/${rooms.length}`} 
          icon={Building2} 
          color="#f59e0b" 
          colorRgb="245,158,11" 
        />
        <StatCard 
          label="Total Allotments" 
          value={`${entries.length}`} 
          icon={CalendarDays} 
          color="#6366f1" 
          colorRgb="99,102,241" 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        
        {/* Main Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Today's Schedule Timeline Section */}
          <div className="card">
            <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={18} style={{ color: 'var(--accent)' }} />
                <h3>Today's Schedule Tracker</h3>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {uniqueDays.map(day => (
                  <button 
                    key={day}
                    className={`btn btn-sm ${selectedDay === day ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => setSelectedDay(day)}
                  >
                    {day}
                  </button>
                ))}
                {uniqueDays.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No slots seeded</span>}
              </div>
            </div>

            {daySlots.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <Clock size={36} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <h3>No time slots configured</h3>
                <p style={{ fontSize: '0.8rem' }}>Please seed time slots under settings to activate daily timeline tracking.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {daySlots.map(slot => {
                  const slotEntries = dayEntriesGrouped[slot._id] || [];
                  return (
                    <div 
                      key={slot._id} 
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '120px 1fr', 
                        gap: 16, 
                        padding: '12px 16px', 
                        background: 'rgba(255,255,255,0.02)', 
                        borderRadius: 'var(--radius)', 
                        border: '1px solid var(--border)',
                        alignItems: 'center'
                      }}
                    >
                      {/* Left: Time and period */}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          {slot.startTime} - {slot.endTime}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--accent-light)', fontWeight: 600, marginTop: 2 }}>
                          Period {slot.orderIndex}
                        </div>
                      </div>

                      {/* Right: Classes running */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {slotEntries.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            No scheduled classes (Free Period)
                          </div>
                        ) : (
                          slotEntries.map(e => (
                            <div 
                              key={e._id}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 10, 
                                padding: '8px 12px', 
                                background: 'var(--bg-card-hover)', 
                                borderRadius: 'var(--radius-sm)', 
                                border: '1px solid var(--border-medium)'
                              }}
                            >
                              <span className="badge badge-indigo" style={{ fontSize: '0.62rem' }}>
                                {e.classSection?.name || '—'}
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {e.customLabel || e.subject?.name || '—'}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                  {e.teacher?.name || '—'}
                                </span>
                              </div>
                              <span className="badge badge-gray" style={{ fontSize: '0.62rem', marginLeft: 4 }}>
                                {e.room?.roomNumber || '—'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Department breakdown card */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <School size={18} style={{ color: 'var(--accent2)' }} />
                <h3>Branch & Department Performance</h3>
              </div>
            </div>
            
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Classes</th>
                    <th>Faculty</th>
                    <th>Rooms</th>
                    <th>Required / Week</th>
                    <th>Coverage Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deptBreakdowns.map(dept => (
                    <tr key={dept._id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dept.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Code: {dept.code} | HOD: {dept.hodName || 'N/A'}</div>
                      </td>
                      <td>
                        <span className="badge badge-cyan">{dept.classesCount} Classes</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem' }}>{dept.teachersCount} Teachers</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem' }}>{dept.roomsCount} Rooms</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                          {dept.scheduledPeriods} / {dept.targetPeriods} periods
                        </div>
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ background: 'var(--border)', borderRadius: 100, height: 6, overflow: 'hidden', flex: 1 }}>
                            <div 
                              style={{ 
                                background: dept.coverage === 100 ? 'var(--success)' : dept.coverage > 50 ? 'var(--warning)' : 'var(--danger)', 
                                height: '100%', 
                                width: `${dept.coverage}%`, 
                                borderRadius: 100 
                              }} 
                            />
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{dept.coverage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {deptBreakdowns.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                        No departments found. Seed departments to load performance stats.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teacher Workload Analysis */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} style={{ color: 'var(--accent3)' }} />
                <h3>Faculty Weekly Workload Analysis</h3>
              </div>
            </div>
            
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Faculty Name</th>
                    <th>Department</th>
                    <th>Handles Subject</th>
                    <th>Periods / Week</th>
                    <th>Allotment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherWorkloads.map(teacher => (
                    <tr key={teacher._id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        <div>{teacher.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{teacher.designation || 'Faculty'}</div>
                      </td>
                      <td>
                        <span className="badge badge-gray">{teacher.department?.code || '—'}</span>
                      </td>
                      <td>
                        {teacher.handledSubject ? (
                          <div style={{ fontSize: '0.82rem' }}>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{teacher.handledSubject.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>({teacher.handledSubject.code})</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>None Assigned</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{teacher.periodsCount} periods</td>
                      <td>
                        <span className={`badge ${teacher.badgeClass}`}>{teacher.status}</span>
                      </td>
                    </tr>
                  ))}
                  {teacherWorkloads.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                        No faculty records available. Add teachers to show workload statistics.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Sidebar Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Quick Actions Panel */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: '0.9rem', fontWeight: 700 }}>⚡ Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => setGenModal(true)}>
                <Wand2 size={16} /> Generate for One Class
              </button>
              <button className="btn btn-primary" style={{ justifyContent: 'center', background: 'linear-gradient(135deg, var(--accent), var(--accent2))' }} onClick={handleGenerateAll}>
                <Layers size={16} /> Generate All Classes
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => navigate('/timetable')}>
                <CalendarDays size={16} /> View Full Timetable
              </button>
              <button className="btn btn-warning" style={{ justifyContent: 'center' }} onClick={() => setSubModal(true)}>
                <UserX size={16} /> Substitute Teacher
              </button>
              <button className="btn btn-success" style={{ justifyContent: 'center' }} onClick={handleRepair}>
                <Wrench size={16} /> Run Repair Algorithm
              </button>
              <button className="btn btn-danger" style={{ justifyContent: 'center' }} onClick={handleClearAll}>
                <Trash2 size={16} /> Clear Entire Timetable
              </button>
            </div>
          </div>

          {/* Timetable Health Checklist / Auditor */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <BadgeAlert size={18} style={{ color: conflictsList.length > 0 ? 'var(--accent3)' : 'var(--success)' }} />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>⚠️ Timetable Health Check</h3>
            </div>

            {conflictsList.length === 0 ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: 'rgba(16,185,129,0.06)', borderRadius: 'var(--radius)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 700 }}>System is Healthy</h4>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 2 }}>
                    No schedules conflicts or unassigned subjects detected. All active classes have complete allocations.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Detected {conflictsList.length} alert(s) requiring attention:
                </div>
                {conflictsList.map((alert, index) => (
                  <div 
                    key={index}
                    style={{ 
                      display: 'flex', 
                      gap: 8, 
                      padding: 10, 
                      borderRadius: 'var(--radius-sm)', 
                      border: '1px solid',
                      background: alert.severity === 'danger' ? 'rgba(239,68,68,0.05)' : alert.severity === 'warning' ? 'rgba(245,158,11,0.05)' : 'rgba(6,182,212,0.05)',
                      borderColor: alert.severity === 'danger' ? 'rgba(239,68,68,0.2)' : alert.severity === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(6,182,212,0.2)'
                    }}
                  >
                    {alert.severity === 'danger' ? (
                      <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                    ) : alert.severity === 'warning' ? (
                      <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
                    ) : (
                      <Info size={16} style={{ color: 'var(--accent2)', flexShrink: 0, marginTop: 1 }} />
                    )}
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: alert.severity === 'danger' ? '#fca5a5' : alert.severity === 'warning' ? '#fcd34d' : '#67e8f9' }}>
                        {alert.type}
                      </div>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 2 }}>
                        {alert.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pro Tips Tipbox */}
          <div className="card" style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <AlertTriangle size={16} style={{ color: 'var(--accent-light)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--accent-light)' }}>Operational Tip:</strong> When new departments or teachers are registered, click the <strong>Generate All Classes</strong> button to run scheduling algorithms and resolve conflicts.
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Generate Modal */}
      {genModal && (
        <Modal title="🪄 Generate Timetable" onClose={() => setGenModal(false)}>
          <div className="form-group">
            <label>Select Class Section</label>
            <select className="form-control" value={genClass} onChange={e => setGenClass(e.target.value)}>
              <option value="">-- Choose a class --</option>
              {classes.map(c => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.department?.code || '?'} — Sem {c.semester} — {c.studentCount} students)
                </option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            This will clear existing entries for the selected class and regenerate from scratch.
          </p>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setGenModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={genLoading}>
              {genLoading ? <span className="inline-spinner" /> : <Zap size={16} />}
              {genLoading ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </Modal>
      )}

      {/* Substitute Modal */}
      {subModal && (
        <Modal title="👤 Substitute Teacher" onClose={() => setSubModal(false)}>
          <div className="form-group">
            <label>Absent Teacher</label>
            <select className="form-control" value={absentId} onChange={e => setAbsentId(e.target.value)}>
              <option value="">-- Select absent teacher --</option>
              {teachers.map(t => (
                <option key={t._id} value={t._id}>{t.name} ({t.department?.code})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Substitute Teacher</label>
            <select className="form-control" value={subId} onChange={e => setSubId(e.target.value)}>
              <option value="">-- Select substitute --</option>
              {teachers.filter(t => t._id !== absentId).map(t => (
                <option key={t._id} value={t._id}>{t.name} ({t.department?.code})</option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            The substitute will take over all the absent teacher's classes where their schedule allows.
          </p>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setSubModal(false)}>Cancel</button>
            <button className="btn btn-warning" onClick={handleSubstitute} disabled={subLoading}>
              {subLoading ? <span className="inline-spinner" /> : <UserX size={16} />}
              {subLoading ? 'Applying…' : 'Apply Substitution'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
