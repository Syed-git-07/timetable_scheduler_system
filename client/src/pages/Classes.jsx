import { useState, useEffect, useCallback } from 'react';
import { getClasses, createClass, updateClass, deleteClass, getDepartments } from '../api/api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, GraduationCap, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY = { name: '', department: '', year: 1, semester: 1, section: 'A', studentCount: 60 };

export default function Classes() {
  const [classes, setClasses] = useState([]);
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
      const [cRes, dRes] = await Promise.all([getClasses(), getDepartments()]);
      setClasses(cRes.data); setDepartments(dRes.data);
    } catch { toast.error('Failed to load classes.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-generate class name when dept/year/section changes
  const buildName = (dept, year, section) => {
    const deptObj = departments.find(d => d._id === dept);
    if (!deptObj) return '';
    return `${deptObj.code}-${year}${section}`;
  };

  const handleFormChange = (field, value) => {
    setForm(f => {
      const updated = { ...f, [field]: value };
      if (['department', 'year', 'section'].includes(field)) {
        updated.name = buildName(
          field === 'department' ? value : f.department,
          field === 'year' ? value : f.year,
          field === 'section' ? value : f.section
        );
      }
      return updated;
    });
  };

  const openAdd = () => {
    const dept = departments[0]?._id || '';
    const deptCode = departments[0]?.code || '';
    setForm({ ...EMPTY, department: dept, name: deptCode ? `${deptCode}-1A` : '' });
    setEditing(null); setModal(true);
  };

  const openEdit = c => {
    setForm({ name: c.name, department: c.department?._id || '', year: c.year, semester: c.semester, section: c.section, studentCount: c.studentCount });
    setEditing(c); setModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.department) return toast.error('Name and department are required.');
    setSaving(true);
    try {
      if (editing) {
        const res = await updateClass(editing._id, form);
        setClasses(c => c.map(x => x._id === editing._id ? res.data : x));
        toast.success('Class updated.');
      } else {
        const res = await createClass(form);
        setClasses(c => [...c, res.data]);
        toast.success('Class created.');
      }
      setModal(false);
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async c => {
    if (!confirm(`Delete class "${c.name}"?`)) return;
    try {
      await deleteClass(c._id);
      setClasses(cs => cs.filter(x => x._id !== c._id));
      toast.success('Class deleted.');
    } catch { toast.error('Delete failed.'); }
  };

  const filtered = classes.filter(c =>
    (c.name.toLowerCase().includes(search.toLowerCase())) &&
    (!deptFilter || c.department?._id === deptFilter)
  );

  return (
    <div>
      <div className="page-header"><h1>Class Sections</h1><p>Manage class groups across all departments and years</p></div>
      <div className="card">
        <div className="card-header">
          <div className="filter-bar" style={{ margin: 0 }}>
            <div className="search-input-wrap"><Search size={16} /><input className="form-control" placeholder="Search classes…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="form-control" style={{ width: 180 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Class</button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" style={{ margin: 'auto' }} /></div>
          : filtered.length === 0 ? <div className="empty-state"><GraduationCap /><h3>No classes found</h3><p>Create class sections to generate timetables for.</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Class Name</th><th>Department</th><th>Year</th><th>Semester</th><th>Section</th><th>Students</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c._id}>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</td>
                        <td><span className="badge badge-indigo">{c.department?.code || '—'}</span></td>
                        <td style={{ textAlign: 'center' }}>Year {c.year}</td>
                        <td style={{ textAlign: 'center' }}>Sem {c.semester}</td>
                        <td style={{ textAlign: 'center' }}><span className="badge badge-cyan">{c.section}</span></td>
                        <td style={{ textAlign: 'center' }}>{c.studentCount}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(c)}><Pencil size={14} /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c)}><Trash2 size={14} /></button>
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
        <Modal title={editing ? 'Edit Class' : 'Add Class Section'} onClose={() => setModal(false)}>
          <div className="form-row">
            <div className="form-group"><label>Department *</label>
              <select className="form-control" value={form.department} onChange={e => handleFormChange('department', e.target.value)}>
                <option value="">-- Select --</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Class Name (auto-generated)</label>
              <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. CSE-2A" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Year</label>
              <select className="form-control" value={form.year} onChange={e => handleFormChange('year', +e.target.value)}>
                {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Semester</label>
              <select className="form-control" value={form.semester} onChange={e => setForm(f => ({ ...f, semester: +e.target.value }))}>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Section</label>
              <input className="form-control" maxLength={2} placeholder="A" value={form.section} onChange={e => handleFormChange('section', e.target.value.toUpperCase())} />
            </div>
            <div className="form-group"><label>Student Count</label>
              <input type="number" className="form-control" min={1} value={form.studentCount} onChange={e => setForm(f => ({ ...f, studentCount: +e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="inline-spinner" /> : null}{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
