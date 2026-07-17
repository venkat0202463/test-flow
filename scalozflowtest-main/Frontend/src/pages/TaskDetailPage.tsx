import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TaskDetailModal from '../components/TaskDetailModal';
import api from '../services/api';

const TaskDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const isCode = id.includes('-');
    let requestUrl = `/tasks/${id}`;
    if (isCode) {
      const parts = id.split('-');
      const prefix = parts[0];
      const sequence = parts[1];
      requestUrl = `/tasks/code/${prefix}/${sequence}`;
    }

    api.get(requestUrl)
      .then(res => {
        if (res.data) {
          setTaskId(res.data.id);
          if (res.data.project?.id) {
            setProjectId(res.data.project.id);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  const handleClose = () => {
    if (projectId) {
      navigate(`/dashboard/project/${projectId}`);
    } else {
      navigate('/dashboard/projects');
    }
  };

  if (loading) {
    return <div className="p-10 font-bold text-[#5E6C84]">Loading task...</div>;
  }

  if (!taskId) {
    return <div className="p-10 font-bold text-[#DE350B]">Task not found.</div>;
  }

  return (
    <div className="w-full min-h-screen bg-white">
      <TaskDetailModal
        taskId={taskId}
        projectId={projectId || 0}
        isOpen={true}
        onClose={handleClose}
        isInline={true}
        onUpdate={() => {}}
        onDelete={handleClose}
      />
    </div>
  );
};

export default TaskDetailPage;
