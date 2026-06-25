import { useState, useEffect, useCallback } from 'react';
import {
  getTimetableEntries, getClasses, getTeachers, getSubjects, getRooms, getTimeSlots,
  updateTimetableEntry, addCustomEntry, deleteEntry, clearClassTimetable,
  generateTimetable, clearAllTimetable
} from '../api/api';
import Modal from '../components/Modal';
import { CalendarDays, Pencil, Trash2, Plus, Wand2, Filter, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const DAY_ORDER = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getCellClass(entry) {
  if (!entry) return 'cell-empty';
  if (entry.customLabel) return 'cell-type-custom';
  const type = entry.subject?.type;
  if (type === 'Lab') return 'cell-type-lab';
  if (type === 'Integrated') return 'cell-type-integrated';
  return 'cell-type-theory';
}

export default function TimetableView({ readOnly = false }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' && !readOnly;

  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [viewMode, setViewMode] = useState('class'); // 'class' | 'teacher'

  // Edit modal
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Custom label modal
  const [customModal, setCustomModal] = useState(null);
  const [customForm, setCustomForm] = useState({ customLabel: '', teacherId: '', roomId: '' });

  const loadMeta = useCallback(async () => {
    try {
      const [cRes, tRes, sRes, rRes, slRes] = await Promise.all([
        getClasses(), getTeachers(), getSubjects(), getRooms(), getTimeSlots()
      ]);
      setClasses(cRes.data);
      setTeachers(tRes.data);
      setSubjects(sRes.data);
      setRooms(rRes.data);
      const sortedSlots = rRes.data && slRes.data.sort((a, b) =>
        (DAY_ORDER[a.dayOfWeek] || 7) - (DAY_ORDER[b.dayOfWeek] || 7) || a.orderIndex - b.orderIndex
      );
      setTimeSlots(slRes.data.sort((a, b) =>
        (DAY_ORDER[a.dayOfWeek] || 7) - (DAY_ORDER[b.dayOfWeek] || 7) || a.orderIndex - b.orderIndex
      ));
      if (cRes.data.length > 0) setSelectedClass(cRes.data[0]._id);
      if (tRes.data.length > 0) setSelectedTeacher(tRes.data[0]._id);
    } catch { toast.error('Failed to load data.'); }
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (viewMode === 'class' && selectedClass) params.classSection = selectedClass;
      if (viewMode === 'teacher' && selectedTeacher) params.teacher = selectedTeacher;
      const res = await getTimetableEntries(params);
      setEntries(res.data);
    } catch { toast.error('Failed to load timetable.'); }
    finally { setLoading(false); }
  }, [viewMode, selectedClass, selectedTeacher]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { if (selectedClass || selectedTeacher) loadEntries(); }, [loadEntries]);

  // Build grid: day → orderIndex → entry
  const days = [...new Set(timeSlots.map(s => s.dayOfWeek))].sort((a, b) => (DAY_ORDER[a] || 7) - (DAY_ORDER[b] || 7));
  const periods = [...new Set(timeSlots.map(s => s.orderIndex))].sort((a, b) => a - b);

  const gridMap = {};
  for (const entry of entries) {
    if (!entry.timeSlot) continue;
    const day = entry.timeSlot.dayOfWeek;
    const idx = entry.timeSlot.orderIndex;
    if (!gridMap[day]) gridMap[day] = {};
    if (!gridMap[day][idx]) gridMap[day][idx] = [];
    gridMap[day][idx].push(entry);
  }

  const getSlot = (day, orderIndex) =>
    timeSlots.find(s => s.dayOfWeek === day && s.orderIndex === orderIndex);

  const openEdit = (entry) => {
    setEditForm({
      subjectId: entry.subject?._id || '',
      teacherId: entry.teacher?._id || '',
      roomId: entry.room?._id || '',
      customLabel: entry.customLabel || ''
    });
    setEditModal(entry);
  };

  const openCustom = (day, orderIndex) => {
    const slot = getSlot(day, orderIndex);
    if (!slot) return;
    setCustomForm({ customLabel: '', teacherId: '', roomId: '', slotId: slot._id });
    setCustomModal({ day, orderIndex, slotId: slot._id });
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      await updateTimetableEntry(editModal._id, editForm);
      toast.success('Entry updated.');
      setEditModal(null);
      loadEntries();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (entryId) => {
    if (!confirm('Clear this period?')) return;
    try {
      await deleteEntry(entryId);
      toast.success('Period cleared.');
      loadEntries();
    } catch { toast.error('Delete failed.'); }
  };

  const handleAddCustom = async () => {
    if (!customForm.customLabel) return toast.error('Enter a label.');
    setSaving(true);
    try {
      await addCustomEntry({ classSectionId: selectedClass, timeSlotId: customModal.slotId, ...customForm });
      toast.success('Custom period added.');
      setCustomModal(null);
      loadEntries();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Add failed.');
    } finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    if (!selectedClass) return toast.error('Select a class.');
    if (!confirm('Regenerate timetable for this class? Existing entries will be replaced.')) return;
    toast.promise(generateTimetable({ classSectionId: selectedClass }), {
      loading: 'Generating timetable…',
      success: r => { loadEntries(); return r.data.message; },
      error: 'Generation failed.'
    });
  };

  const handlePrint = () => window.print();

  const selectedClassObj = classes.find(c => c._id === selectedClass);
  const selectedTeacherObj = teachers.find(t => t._id === selectedTeacher);

  return (
    <div>
      <div className="page-header">
        <h1>Timetable View</h1>
        <p>Weekly schedule grid — click any cell to edit</p>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 3, gap: 2 }}>
            <button
              className={`btn btn-sm ${viewMode === 'class' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              onClick={() => setViewMode('class')}
            >By Class</button>
            <button
              className={`btn btn-sm ${viewMode === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              onClick={() => setViewMode('teacher')}
            >By Teacher</button>
          </div>

          {viewMode === 'class' ? (
            <select className="form-control" style={{ width: 200 }} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              {classes.map(c => <option key={c._id} value={c._id}>{c.name} ({c.department?.code})</option>)}
            </select>
          ) : (
            <select className="form-control" style={{ width: 200 }} value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
              {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          )}

          <div style={{ flex: 1 }} />

          {isAdmin && viewMode === 'class' && (
            <button className="btn btn-primary btn-sm" onClick={handleGenerate}>
              <Wand2 size={14} /> Regenerate
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
            <Download size={14} /> Print
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { cls: 'cell-type-theory', label: 'Theory' },
            { cls: 'cell-type-lab', label: 'Lab' },
            { cls: 'cell-type-integrated', label: 'Integrated' },
            { cls: 'cell-type-custom', label: 'Custom / NPTEL' },
          ].map(l => (
            <div key={l.cls} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className={`cell-content ${l.cls}`} style={{ width: 16, height: 16, minHeight: 'unset', borderRadius: 4, padding: 0, flex: 'none' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div className="loading-spinner" style={{ margin: 'auto 0 16px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading timetable…</p>
        </div>
      ) : timeSlots.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <CalendarDays />
            <h3>No time slots configured</h3>
            <p>Go to Time Slots and seed the 8-period academic day first.</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="timetable-grid-wrap">
            <table className="timetable-grid">
              <thead>
                <tr>
                  <th className="day-header">Day / Period</th>
                  {periods.map(p => {
                    const slot = timeSlots.find(s => s.orderIndex === p);
                    return (
                      <th key={p}>
                        <div>P{p}</div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 400, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {slot ? `${slot.startTime}–${slot.endTime}` : ''}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day}>
                    <th className="day-header">{day}</th>
                    {periods.map(p => {
                      const cell = gridMap[day]?.[p];
                      const entry = cell?.[0];
                      const hasMultiple = cell?.length > 1;

                      return (
                        <td key={p}>
                          {entry ? (
                            <div className={`cell-content ${getCellClass(entry)}`}
                              style={{ position: 'relative' }}
                              onClick={() => isAdmin && openEdit(entry)}
                              title={isAdmin ? 'Click to edit' : ''}
                            >
                              <div className="cell-subject">
                                {entry.customLabel || entry.subject?.code || '—'}
                                {hasMultiple && <span style={{ marginLeft: 4, fontSize: '0.6rem' }}>+{cell.length - 1}</span>}
                              </div>
                              <div className="cell-teacher">👤 {entry.teacher?.name || '—'}</div>
                              <div className="cell-room">🏛 {entry.room?.roomNumber || '—'}</div>
                              {isAdmin && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDelete(entry._id); }}
                                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, padding: '1px 3px', color: '#fca5a5', fontSize: 10, opacity: 0, transition: 'opacity 0.2s' }}
                                  className="cell-delete-btn"
                                >✕</button>
                              )}
                            </div>
                          ) : (
                            <div
                              className="cell-content cell-empty"
                              onClick={() => isAdmin && viewMode === 'class' && openCustom(day, p)}
                              title={isAdmin ? 'Click to add custom entry' : 'Free Period'}
                            >
                              {isAdmin ? <Plus size={14} /> : '—'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && isAdmin && (
        <Modal title="✏️ Edit Timetable Cell" onClose={() => setEditModal(null)} size="lg">
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <strong>Current:</strong> {editModal.subject?.name || editModal.customLabel || 'Custom'} — {editModal.teacher?.name || '—'} — {editModal.timeSlot?.dayOfWeek} P{editModal.timeSlot?.orderIndex}
          </div>

          <div className="form-group">
            <label>Custom Label (NPTEL, Free Study, etc.)</label>
            <input className="form-control" placeholder="Leave blank for regular subject" value={editForm.customLabel}
              onChange={e => setEditForm(f => ({ ...f, customLabel: e.target.value }))} />
          </div>

          {!editForm.customLabel && (
            <div className="form-group">
              <label>Subject</label>
              <select className="form-control" value={editForm.subjectId} onChange={e => setEditForm(f => ({ ...f, subjectId: e.target.value }))}>
                <option value="">-- Keep current --</option>
                {subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Teacher</label>
              <select className="form-control" value={editForm.teacherId} onChange={e => setEditForm(f => ({ ...f, teacherId: e.target.value }))}>
                <option value="">-- Keep current --</option>
                {teachers.map(t => <option key={t._id} value={t._id}>{t.name} ({t.department?.code})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Room</label>
              <select className="form-control" value={editForm.roomId} onChange={e => setEditForm(f => ({ ...f, roomId: e.target.value }))}>
                <option value="">-- Keep current --</option>
                {rooms.map(r => <option key={r._id} value={r._id}>{r.roomNumber} ({r.type}, cap {r.capacity})</option>)}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-danger btn-sm" onClick={() => { handleDelete(editModal._id); setEditModal(null); }}>
              <Trash2 size={14} /> Clear Period
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <span className="inline-spinner" /> : <Pencil size={14} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* Custom Entry Modal */}
      {customModal && isAdmin && (
        <Modal title="➕ Add Custom Entry" onClose={() => setCustomModal(null)}>
          <div style={{ marginBottom: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Adding to: <strong>{customModal.day}</strong> Period <strong>{customModal.orderIndex}</strong>
          </div>
          <div className="form-group">
            <label>Label *</label>
            <input className="form-control" placeholder="e.g. NPTEL, LeetCode, Free Study" value={customForm.customLabel}
              onChange={e => setCustomForm(f => ({ ...f, customLabel: e.target.value }))} autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Teacher (optional)</label>
              <select className="form-control" value={customForm.teacherId} onChange={e => setCustomForm(f => ({ ...f, teacherId: e.target.value }))}>
                <option value="">None</option>
                {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Room (optional)</label>
              <select className="form-control" value={customForm.roomId} onChange={e => setCustomForm(f => ({ ...f, roomId: e.target.value }))}>
                <option value="">None</option>
                {rooms.map(r => <option key={r._id} value={r._id}>{r.roomNumber}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setCustomModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddCustom} disabled={saving}>
              {saving ? <span className="inline-spinner" /> : <Plus size={14} />}
              {saving ? 'Adding…' : 'Add Entry'}
            </button>
          </div>
        </Modal>
      )}

      <style>{`
        .cell-content:hover .cell-delete-btn { opacity: 1 !important; }
        @media print {
          .sidebar, .btn, .card-header button, .filter-bar { display: none !important; }
          .main-content { margin-left: 0 !important; }
          .timetable-grid-wrap { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
