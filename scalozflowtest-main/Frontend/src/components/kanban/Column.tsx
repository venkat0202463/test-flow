import React, { useState, useRef, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { TaskCard } from './TaskCard';
import type { BoardColumn, Task } from '../../types';
import { MoreHorizontal, Edit2, Trash2, CheckCircle2 } from 'lucide-react';

interface ColumnProps {
  column: BoardColumn;
  tasks: Task[];
  index: number;
  onTaskClick: (task: Task) => void;
  onDeleteColumn: (id: number) => void;
  onRenameColumn: (id: number, newName: string) => void;
}

export const Column: React.FC<ColumnProps> = ({ column, tasks, index, onTaskClick, onDeleteColumn, onRenameColumn }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRenameSubmit = () => {
    if (columnName.trim() && columnName !== column.name) {
      onRenameColumn(column.id, columnName);
    } else {
      setColumnName(column.name);
    }
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    if (window.confirm('Are you sure you want to delete this column?')) {
      onDeleteColumn(column.id);
    }
    setShowDropdown(false);
  };

  return (
    <Draggable draggableId={`col-${column.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex flex-col bg-[#F4F5F7] rounded-[4px] shrink-0 w-[280px] h-fit max-h-full mr-4 ${
            snapshot.isDragging ? 'shadow-2xl' : ''
          }`}
        >
          {/* Column Header */}
          <div
            {...provided.dragHandleProps}
            className="kanban-column-header board-column-header px-3 pt-3 pb-2 flex items-center justify-between group"
          >
            {isEditing ? (
              <input
                autoFocus
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                }}
                className="text-[12px] font-bold text-[#5E6C84] bg-white border-[#4C9AFF] border-2 rounded px-2 py-1 outline-none w-full"
              />
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h3 
                  onClick={() => setIsEditing(true)}
                  className="column-title text-[15px] font-medium text-[#1F6FEB] uppercase tracking-wider cursor-text hover:underline truncate"
                >
                  {column.name}
                </h3>
                {column.name.toUpperCase() === 'DONE' && <CheckCircle2 size={14} className="text-emerald-500" />}
                <span className="text-[12px] text-[#5E6C84] font-medium ml-1">
                  {tasks.length}
                </span>
              </div>
            )}

            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-1 text-[#5E6C84] hover:bg-[#EBECF0] rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal size={16} />
              </button>
              {showDropdown && (
                <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-[#DFE1E6] rounded shadow-lg z-10 py-1">
                  <button onClick={() => {setIsEditing(true); setShowDropdown(false);}} className="w-full px-3 py-2 text-left text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-2"><Edit2 size={14} /> Rename</button>
                  <button onClick={handleDeleteClick} className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                </div>
              )}
            </div>
          </div>

          {/* Task List Container */}
          <Droppable droppableId={`col-${column.id}`} type="TASK">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex-1 p-1.5 min-h-[150px] transition-colors overflow-y-auto custom-scrollbar ${
                   snapshot.isDraggingOver ? 'bg-[#EBECF0]' : ''
                }`}
              >
                {tasks.map((task, i) => (
                  <TaskCard key={task.id} task={task} index={i} onClick={onTaskClick} />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
};
