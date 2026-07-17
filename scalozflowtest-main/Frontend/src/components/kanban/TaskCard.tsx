import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import type { Task } from '../../types';
import { Zap } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: (task: Task) => void;
}

const getTagColor = (tag: string) => {
  const colors = [
    { bg: 'bg-[#DEEBFF]', text: 'text-[#0747A6]' }, // Jira Blue
    { bg: 'bg-[#EAE6FF]', text: 'text-[#403294]' }, // Jira Purple
    { bg: 'bg-[#FFF0B3]', text: 'text-[#172B4D]' }, // Jira Yellow
    { bg: 'bg-[#E3FCEF]', text: 'text-[#006644]' }, // Jira Green
    { bg: 'bg-[#FFEBE6]', text: 'text-[#BF2600]' }, // Jira Red
  ];
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, index, onClick }) => {
  return (
    <Draggable draggableId={`task-${task.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={`bg-white rounded-[3px] p-2.5 shadow-sm border border-transparent hover:bg-[#F4F5F7] transition-all duration-100 mb-1.5 cursor-pointer group select-none ${
            snapshot.isDragging ? 'shadow-lg rotate-2 scale-[1.02] z-[1000] !bg-white' : ''
          }`}
          style={{
            ...provided.draggableProps.style,
            boxShadow: snapshot.isDragging ? '0 10px 20px -5px rgba(9, 30, 66, 0.25)' : '0 1px 1px rgba(9, 30, 66, 0.25)',
          }}
        >
          {/* Task Title */}
          <h4 className="text-[14px] font-normal text-[#172B4D] leading-5 mb-2 group-hover:text-[#1F6FEB]">
            {task.title}
          </h4>
          
          {/* Jira Labels */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {task.tags.map((tag, tagIndex) => {
                const color = getTagColor(tag);
                return (
                  <span
                    key={tagIndex}
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded-[2px] uppercase ${color.bg} ${color.text}`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          )}

          {/* Footer Area */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-[#1F6FEB] rounded-[2px] flex items-center justify-center">
                 <Zap size={10} className="text-white fill-white" />
              </div>
              <span className="text-[12px] font-medium text-[#5E6C84] hover:underline uppercase tracking-tight">
                FT-{task.id}
              </span>
            </div>
            
            {/* Assignee Avatar positioned at bottom right like in Jira */}
            <div className="flex -space-x-1">
              <div className="w-6 h-6 rounded-full bg-[#1F6FEB] flex items-center justify-center text-[9px] font-bold text-white border-2 border-white shadow-sm overflow-hidden hover:scale-110 transition-transform">
                {task.assignee ? task.assignee.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
