import { useState, useEffect, useCallback } from 'react';
import { getSubjects, createSubject, updateSubject, deleteSubject, getDepartments } from '../api/api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, BookOpen, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY = { name: '', code: '', credits: 3, periodsPerWeek: 4, type: 'Theory', department: '', semester: 1 };
const TYPES = ['Theory', 'Lab', 'Integrated'];

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sRes, dRes] = await Promise.all([getSubjects(), getDepartments()]);
      setSubjects(sRes.data);
      setDepartments(dRes.data);
    } catch { toast.error('Failed to load subjects.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ ...EMPTY, department: departments[0]?._id || '' }); setEditing(null); setModal(true); };
  const openEdit = s => {
    setForm({ name: s.name, code: s.code, credits: s.credits, periodsPerWeek: s.periodsPerWeek, type: s.type, department: s.department?._id || '', semester: s.semester || 1 });
    setEditing(s); setModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code || !form.department) return toast.error('Name, code, and department are required.');
    setSaving(true);
    try {
      if (editing) {
        const res = await updateSubject(editing._id, form);
        setSubjects(s => s.map(x => x._id === editing._id ? res.data : x));
        toast.success('Subject updated.');
      } else {
        const res = await createSubject(form);
        setSubjects(s => [...s, res.data]);
        toast.success('Subject created.');
      }
      setModal(false);
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async s => {
    if (!confirm(`Delete subject "${s.name}"?`)) return;
    try {
      await deleteSubject(s._id);
      setSubjects(subs => subs.filter(x => x._id !== s._id));
      toast.success('Subject deleted.');
    } catch { toast.error('Delete failed.'); }
  };

  const typeBadge = t => ({ Theory: 'badge-indigo', Lab: 'badge-cyan', Integrated: 'badge-green' }[t] || 'badge-gray');

  const filtered = subjects.filter(s =>
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase())) &&
    (!deptFilter || s.department?._id === deptFilter)
  );

  return (
    <div>
      <div className="page-header"><h1>Subjects</h1><p>Manage courses and subjects across all departments</p></div>
      <div className="card">
        <div className="card-header">
          <div className="filter-bar" style={{ margin: 0 }}>
            <div className="search-input-wrap"><Search size={16} /><input className="form-control" placeholder="Search subjects…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="form-control" style={{ width: 180 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Subject</button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" style={{ margin: 'auto' }} /></div>
          : filtered.length === 0 ? <div className="empty-state"><BookOpen /><h3>No subjects found</h3><p>Add subjects to assign to teachers.</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Subject</th><th>Code</th><th>Department</th><th>Sem</th><th>Type</th><th>Credits</th><th>Periods/Week</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filtered.map(s => (
                      <tr key={s._id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                        <td><span className="badge badge-gray">{s.code}</span></td>
                        <td><span className="badge badge-indigo">{s.department?.code || '—'}</span></td>
                        <td style={{ textAlign: 'center' }}>{s.semester || '—'}</td>
                        <td><span className={`badge ${typeBadge(s.type)}`}>{s.type}</span></td>
                        <td style={{ textAlign: 'center' }}>{s.credits}</td>
                        <td style={{ textAlign: 'center' }}>{s.periodsPerWeek}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(s)}><Pencil size={14} /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(s)}><Trash2 size={14} /></button>
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
        <Modal title={editing ? 'Edit Subject' : 'Add Subject'} onClose={() => setModal(false)}>
          <div className="form-row">
            <div className="form-group"><label>Subject Name *</label><input className="form-control" placeholder="e.g. Data Structures" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="form-group"><label>Code *</label><input className="form-control" placeholder="e.g. CS301" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Department *</label>
              <select className="form-control" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                <option value="">-- Select --</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Type *</label>
              <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Semester</label><input type="number" className="form-control" min={1} max={8} value={form.semester} onChange={e => setForm(f => ({ ...f, semester: +e.target.value }))} /></div>
            <div className="form-group"><label>Credits</label><input type="number" className="form-control" min={0} value={form.credits} onChange={e => setForm(f => ({ ...f, credits: +e.target.value }))} /></div>
          </div>
          <div className="form-group"><label>Periods Per Week</label><input type="number" className="form-control" min={1} max={10} value={form.periodsPerWeek} onChange={e => setForm(f => ({ ...f, periodsPerWeek: +e.target.value }))} /></div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="inline-spinner" /> : null}{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
