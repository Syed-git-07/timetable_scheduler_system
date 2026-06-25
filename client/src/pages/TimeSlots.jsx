import { useState, useEffect, useCallback } from 'react';
import { getTimeSlots, createTimeSlot, deleteTimeSlot, seedTimeSlots, clearTimeSlots } from '../api/api';
import Modal from '../components/Modal';
import { Plus, Trash2, Clock, Zap, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY = { dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:55', orderIndex: 1 };
const DAY_ORDER = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

export default function TimeSlots() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getTimeSlots();
      const sorted = res.data.sort((a, b) => (DAY_ORDER[a.dayOfWeek] || 7) - (DAY_ORDER[b.dayOfWeek] || 7) || a.orderIndex - b.orderIndex);
      setSlots(sorted);
    } catch { toast.error('Failed to load time slots.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    if (!confirm('Auto-seed 8 periods per day (Mon–Fri)? Clear existing slots first.')) return;
    try {
      const res = await seedTimeSlots();
      toast.success(res.data.message);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Seed failed.'); }
  };

  const handleClear = async () => {
    if (!confirm('Clear all time slots? This will also affect the timetable.')) return;
    try {
      const res = await clearTimeSlots();
      toast.success(res.data.message);
      setSlots([]);
    } catch { toast.error('Clear failed.'); }
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await createTimeSlot(form);
      setSlots(s => [...s, res.data].sort((a, b) => (DAY_ORDER[a.dayOfWeek] || 7) - (DAY_ORDER[b.dayOfWeek] || 7) || a.orderIndex - b.orderIndex));
      toast.success('Time slot added.');
      setModal(false);
    } catch (e) { toast.error(e.response?.data?.message || 'Add failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async s => {
    if (!confirm(`Delete slot ${s.dayOfWeek} P${s.orderIndex}?`)) return;
    try {
      await deleteTimeSlot(s._id);
      setSlots(sl => sl.filter(x => x._id !== s._id));
      toast.success('Slot deleted.');
    } catch { toast.error('Delete failed.'); }
  };

  // Group by day
  const grouped = DAYS.reduce((acc, day) => {
    acc[day] = slots.filter(s => s.dayOfWeek === day);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header"><h1>Time Slots</h1><p>Configure the daily period schedule</p></div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{slots.length} slots configured</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-success btn-sm" onClick={handleSeed}><Zap size={14} /> Auto-Seed 8-Period Day</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setModal(true)}><Plus size={14} /> Add Slot</button>
            <button className="btn btn-danger btn-sm" onClick={handleClear}><RefreshCw size={14} /> Clear All</button>
          </div>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" style={{ margin: 'auto' }} /></div>
          : slots.length === 0 ? (
            <div className="empty-state">
              <Clock />
              <h3>No time slots configured</h3>
              <p>Click "Auto-Seed 8-Period Day" to quickly set up a standard academic day.</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleSeed}><Zap size={16} /> Auto-Seed</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {DAYS.filter(d => grouped[d]?.length > 0).map(day => (
                <div key={day} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ background: 'rgba(99,102,241,0.1)', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-light)' }}>{day}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>{grouped[day].length} periods</span>
                  </div>
                  {grouped[day].map((s, i) => (
                    <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < grouped[day].length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>P{s.orderIndex}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {s.startTime} – {s.endTime}
                        </span>
                      </div>
                      <button className="btn btn-danger btn-icon" style={{ padding: '4px 6px' }} onClick={() => handleDelete(s)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
      </div>

      {modal && (
        <Modal title="Add Time Slot" onClose={() => setModal(false)}>
          <div className="form-group"><label>Day of Week</label>
            <select className="form-control" value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Start Time</label><input type="time" className="form-control" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} /></div>
            <div className="form-group"><label>End Time</label><input type="time" className="form-control" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label>Period Order Index</label><input type="number" className="form-control" min={1} value={form.orderIndex} onChange={e => setForm(f => ({ ...f, orderIndex: +e.target.value }))} /></div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving ? <span className="inline-spinner" /> : null}{saving ? 'Adding…' : 'Add Slot'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
