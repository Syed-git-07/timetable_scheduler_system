import { useState, useEffect, useCallback } from 'react';
import { getTeachers, createTeacher, updateTeacher, toggleTeacher, deleteTeacher, getDepartments, getSubjects } from '../api/api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Users, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY = { name: '', department: '', email: '', phone: '', designation: '', handledSubject: '' };

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tRes, dRes, sRes] = await Promise.all([getTeachers(), getDepartments(), getSubjects()]);
      setTeachers(tRes.data); setDepartments(dRes.data); setSubjects(sRes.data);
    } catch { toast.error('Failed to load teachers.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ ...EMPTY, department: departments[0]?._id || '' }); setEditing(null); setModal(true); };
  const openEdit = t => {
    setForm({ name: t.name, department: t.department?._id || '', email: t.email || '', phone: t.phone || '', designation: t.designation || '', handledSubject: t.handledSubject?._id || '' });
    setEditing(t); setModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.department) return toast.error('Name and department are required.');
    setSaving(true);
    try {
      const payload = { ...form, handledSubject: form.handledSubject || undefined };
      if (editing) {
        const res = await updateTeacher(editing._id, payload);
        setTeachers(t => t.map(x => x._id === editing._id ? res.data : x));
        toast.success('Teacher updated.');
      } else {
        const res = await createTeacher(payload);
        setTeachers(t => [...t, res.data]);
        toast.success('Teacher added.');
      }
      setModal(false);
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleToggle = async t => {
    try {
      const res = await toggleTeacher(t._id);
      setTeachers(ts => ts.map(x => x._id === t._id ? res.data : x));
      toast.success(`${res.data.name} marked as ${res.data.available ? 'available' : 'unavailable'}.`);
    } catch { toast.error('Failed to toggle availability.'); }
  };

  const handleDelete = async t => {
    if (!confirm(`Delete teacher "${t.name}"?`)) return;
    try {
      await deleteTeacher(t._id);
      setTeachers(ts => ts.filter(x => x._id !== t._id));
      toast.success('Teacher deleted.');
    } catch { toast.error('Delete failed.'); }
  };

  const deptSubjects = subjects.filter(s => !form.department || s.department?._id === form.department);

  const filtered = teachers.filter(t =>
    (t.name.toLowerCase().includes(search.toLowerCase()) || (t.department?.name || '').toLowerCase().includes(search.toLowerCase())) &&
    (!deptFilter || t.department?._id === deptFilter)
  );

  return (
    <div>
      <div className="page-header"><h1>Teachers</h1><p>Manage faculty across all departments</p></div>
      <div className="card">
        <div className="card-header">
          <div className="filter-bar" style={{ margin: 0 }}>
            <div className="search-input-wrap"><Search size={16} /><input className="form-control" placeholder="Search teachers…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="form-control" style={{ width: 180 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Teacher</button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" style={{ margin: 'auto' }} /></div>
          : filtered.length === 0 ? <div className="empty-state"><Users /><h3>No teachers found</h3><p>Add faculty members to assign to timetable slots.</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Department</th><th>Designation</th><th>Subject</th><th>Email</th><th>Available</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t._id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</td>
                        <td><span className="badge badge-indigo">{t.department?.code || '—'}</span></td>
                        <td style={{ fontSize: '0.8rem' }}>{t.designation || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {t.handledSubject ? <span className="badge badge-cyan">{t.handledSubject.code}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.email || '—'}</td>
                        <td>
                          <label className="toggle" title={t.available ? 'Mark unavailable' : 'Mark available'}>
                            <input type="checkbox" checked={t.available} onChange={() => handleToggle(t)} />
                            <span className="toggle-slider" />
                          </label>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(t)}><Pencil size={14} /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(t)}><Trash2 size={14} /></button>
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
        <Modal title={editing ? 'Edit Teacher' : 'Add Teacher'} onClose={() => setModal(false)}>
          <div className="form-row">
            <div className="form-group"><label>Full Name *</label><input className="form-control" placeholder="Dr. Jane Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="form-group"><label>Department *</label>
              <select className="form-control" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value, handledSubject: '' }))}>
                <option value="">-- Select --</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Designation</label><input className="form-control" placeholder="e.g. Associate Professor" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></div>
            <div className="form-group"><label>Email</label><input type="email" className="form-control" placeholder="teacher@college.edu" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Phone</label><input className="form-control" placeholder="+91 9999999999" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="form-group"><label>Handled Subject</label>
              <select className="form-control" value={form.handledSubject} onChange={e => setForm(f => ({ ...f, handledSubject: e.target.value }))}>
                <option value="">-- Select Subject --</option>
                {deptSubjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="inline-spinner" /> : null}{saving ? 'Saving…' : editing ? 'Update' : 'Add Teacher'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
