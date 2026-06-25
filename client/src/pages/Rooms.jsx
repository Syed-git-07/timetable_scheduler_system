import { useState, useEffect, useCallback } from 'react';
import { getRooms, createRoom, updateRoom, toggleRoom, deleteRoom, getDepartments } from '../api/api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Building2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY = { roomNumber: '', capacity: 60, type: 'Classroom', building: '', floor: 0, department: '' };
const TYPES = ['Classroom', 'Lab', 'Seminar Hall', 'Auditorium'];

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rRes, dRes] = await Promise.all([getRooms(), getDepartments()]);
      setRooms(rRes.data); setDepartments(dRes.data);
    } catch { toast.error('Failed to load rooms.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = r => {
    setForm({ roomNumber: r.roomNumber, capacity: r.capacity, type: r.type, building: r.building || '', floor: r.floor || 0, department: r.department?._id || '' });
    setEditing(r); setModal(true);
  };

  const handleSave = async () => {
    if (!form.roomNumber) return toast.error('Room number is required.');
    setSaving(true);
    try {
      const payload = { ...form, department: form.department || undefined };
      if (editing) {
        const res = await updateRoom(editing._id, payload);
        setRooms(r => r.map(x => x._id === editing._id ? res.data : x));
        toast.success('Room updated.');
      } else {
        const res = await createRoom(payload);
        setRooms(r => [...r, res.data]);
        toast.success('Room added.');
      }
      setModal(false);
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleToggle = async r => {
    try {
      const res = await toggleRoom(r._id);
      setRooms(rs => rs.map(x => x._id === r._id ? res.data : x));
      toast.success(`Room ${res.data.roomNumber} is now ${res.data.available ? 'available' : 'unavailable'}.`);
    } catch { toast.error('Toggle failed.'); }
  };

  const handleDelete = async r => {
    if (!confirm(`Delete room "${r.roomNumber}"?`)) return;
    try {
      await deleteRoom(r._id);
      setRooms(rs => rs.filter(x => x._id !== r._id));
      toast.success('Room deleted.');
    } catch { toast.error('Delete failed.'); }
  };

  const typeBadge = t => ({ Classroom: 'badge-indigo', Lab: 'badge-cyan', 'Seminar Hall': 'badge-amber', Auditorium: 'badge-rose' }[t] || 'badge-gray');

  const filtered = rooms.filter(r =>
    (r.roomNumber.toLowerCase().includes(search.toLowerCase()) || (r.building || '').toLowerCase().includes(search.toLowerCase())) &&
    (!typeFilter || r.type === typeFilter)
  );

  return (
    <div>
      <div className="page-header"><h1>Rooms</h1><p>Manage classrooms, labs, and facilities</p></div>
      <div className="card">
        <div className="card-header">
          <div className="filter-bar" style={{ margin: 0 }}>
            <div className="search-input-wrap"><Search size={16} /><input className="form-control" placeholder="Search rooms…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="form-control" style={{ width: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Room</button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" style={{ margin: 'auto' }} /></div>
          : filtered.length === 0 ? <div className="empty-state"><Building2 /><h3>No rooms found</h3><p>Add rooms and labs to be scheduled.</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Room</th><th>Building</th><th>Type</th><th>Capacity</th><th>Floor</th><th>Department</th><th>Available</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r._id}>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.roomNumber}</td>
                        <td>{r.building || '—'}</td>
                        <td><span className={`badge ${typeBadge(r.type)}`}>{r.type}</span></td>
                        <td style={{ textAlign: 'center' }}>{r.capacity}</td>
                        <td style={{ textAlign: 'center' }}>{r.floor ?? '—'}</td>
                        <td>{r.department ? <span className="badge badge-gray">{r.department.code}</span> : '—'}</td>
                        <td>
                          <label className="toggle">
                            <input type="checkbox" checked={r.available} onChange={() => handleToggle(r)} />
                            <span className="toggle-slider" />
                          </label>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(r)}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Room' : 'Add Room'} onClose={() => setModal(false)}>
          <div className="form-row">
            <div className="form-group"><label>Room Number *</label><input className="form-control" placeholder="e.g. A-101" value={form.roomNumber} onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))} /></div>
            <div className="form-group"><label>Type *</label>
              <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Capacity</label><input type="number" className="form-control" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))} /></div>
            <div className="form-group"><label>Floor</label><input type="number" className="form-control" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: +e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Building</label><input className="form-control" placeholder="e.g. Block A" value={form.building} onChange={e => setForm(f => ({ ...f, building: e.target.value }))} /></div>
            <div className="form-group"><label>Department (optional)</label>
              <select className="form-control" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                <option value="">Shared / None</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="inline-spinner" /> : null}{saving ? 'Saving…' : editing ? 'Update' : 'Add Room'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
