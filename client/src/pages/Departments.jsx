import { useState, useEffect, useCallback } from 'react';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../api/api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, School, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY = { name: '', code: '', hodName: '', description: '' };

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getDepartments();
      setDepartments(res.data);
    } catch { toast.error('Failed to load departments.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setModal('edit'); };
  const openEdit = d => { setForm({ name: d.name, code: d.code, hodName: d.hodName || '', description: d.description || '' }); setEditing(d); setModal('edit'); };

  const handleSave = async () => {
    if (!form.name || !form.code) return toast.error('Name and code are required.');
    setSaving(true);
    try {
      if (editing) {
        const res = await updateDepartment(editing._id, form);
        setDepartments(d => d.map(x => x._id === editing._id ? res.data : x));
        toast.success('Department updated.');
      } else {
        const res = await createDepartment(form);
        setDepartments(d => [...d, res.data]);
        toast.success('Department created.');
      }
      setModal(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async d => {
    if (!confirm(`Delete department "${d.name}"?`)) return;
    try {
      await deleteDepartment(d._id);
      setDepartments(deps => deps.filter(x => x._id !== d._id));
      toast.success('Department deleted.');
    } catch (e) { toast.error(e.response?.data?.message || 'Delete failed.'); }
  };

  const filtered = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>Departments</h1>
        <p>Manage college departments across the institution</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filter-bar" style={{ margin: 0 }}>
            <div className="search-input-wrap">
              <Search size={16} />
              <input className="form-control" placeholder="Search departments…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Department
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><span className="loading-spinner" style={{ margin: 'auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><School /><h3>No departments found</h3><p>Add your first department to get started.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Department</th><th>Code</th><th>Head of Dept</th><th>Description</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d._id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</td>
                    <td><span className="badge badge-indigo">{d.code}</span></td>
                    <td>{d.hodName || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(d)}><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(d)}><Trash2 size={14} /></button>
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
        <Modal title={editing ? 'Edit Department' : 'Add Department'} onClose={() => setModal(null)}>
          <div className="form-row">
            <div className="form-group">
              <label>Department Name *</label>
              <input className="form-control" placeholder="e.g. Computer Science" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Code *</label>
              <input className="form-control" placeholder="e.g. CSE" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Head of Department</label>
            <input className="form-control" placeholder="HOD name" value={form.hodName} onChange={e => setForm(f => ({ ...f, hodName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-control" rows={3} placeholder="Brief description…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="inline-spinner" /> : null}
              {saving ? 'Saving…' : (editing ? 'Update' : 'Create')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
