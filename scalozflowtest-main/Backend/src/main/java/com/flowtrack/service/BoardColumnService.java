package com.flowtrack.service;

import com.flowtrack.model.BoardColumn;
import com.flowtrack.model.Project;
import com.flowtrack.model.Task;
import com.flowtrack.repository.BoardColumnRepository;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class BoardColumnService {

    @Autowired
    private BoardColumnRepository columnRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    public synchronized List<BoardColumn> getColumnsByProject(Long projectId) {
        List<BoardColumn> columns = columnRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
        
        // 1. If empty, create the 4 defaults
        if (columns.isEmpty()) {
            Project project = projectRepository.findById(projectId).orElse(null);
            if (project != null) {
                String[] defaults = {"To Do", "In Progress", "In Review", "Done", "UAT"};
                for (int i = 0; i < defaults.length; i++) {
                    BoardColumn col = new BoardColumn();
                    col.setName(defaults[i]);
                    col.setProject(project);
                    col.setOrderIndex(i);
                    columnRepository.save(col);
                }
                columns = columnRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
            }
            return columns;
        }

        // 2. Enforce ONLY unique "To Do", "In Progress", "In Review", "Done", "UAT" columns and deduplicate
        Project project = projectRepository.findById(projectId).orElse(null);
        if (project != null) {
            BoardColumn toDoCol = null;
            BoardColumn inProgressCol = null;
            BoardColumn inReviewCol = null;
            BoardColumn doneCol = null;
            BoardColumn uatCol = null;

            for (BoardColumn col : columns) {
                String nameNorm = col.getName().trim().toLowerCase().replace(" ", "");
                if (nameNorm.equals("todo")) {
                    if (toDoCol == null) toDoCol = col;
                } else if (nameNorm.equals("inprogress")) {
                    if (inProgressCol == null) inProgressCol = col;
                } else if (nameNorm.equals("inreview")) {
                    if (inReviewCol == null) inReviewCol = col;
                } else if (nameNorm.equals("done")) {
                    if (doneCol == null) doneCol = col;
                } else if (nameNorm.equals("uat")) {
                    if (uatCol == null) uatCol = col;
                }
            }

            // Auto-create missing default columns
            if (toDoCol == null) {
                toDoCol = new BoardColumn();
                toDoCol.setName("To Do");
                toDoCol.setProject(project);
                toDoCol.setOrderIndex(0);
                toDoCol = columnRepository.save(toDoCol);
            }
            if (inProgressCol == null) {
                inProgressCol = new BoardColumn();
                inProgressCol.setName("In Progress");
                inProgressCol.setProject(project);
                inProgressCol.setOrderIndex(1);
                inProgressCol = columnRepository.save(inProgressCol);
            }
            if (inReviewCol == null) {
                inReviewCol = new BoardColumn();
                inReviewCol.setName("In Review");
                inReviewCol.setProject(project);
                inReviewCol.setOrderIndex(2);
                inReviewCol = columnRepository.save(inReviewCol);
            }
            if (doneCol == null) {
                doneCol = new BoardColumn();
                doneCol.setName("Done");
                doneCol.setProject(project);
                doneCol.setOrderIndex(3);
                doneCol = columnRepository.save(doneCol);
            }
            if (uatCol == null) {
                uatCol = new BoardColumn();
                uatCol.setName("UAT");
                uatCol.setProject(project);
                uatCol.setOrderIndex(4);
                uatCol = columnRepository.save(uatCol);
            }

            // Sync index positions
            toDoCol.setOrderIndex(0);
            columnRepository.save(toDoCol);
            inProgressCol.setOrderIndex(1);
            columnRepository.save(inProgressCol);
            inReviewCol.setOrderIndex(2);
            columnRepository.save(inReviewCol);
            doneCol.setOrderIndex(3);
            columnRepository.save(doneCol);
            uatCol.setOrderIndex(4);
            columnRepository.save(uatCol);

            // Prune duplicate or non-standard columns
            boolean modified = false;
            for (BoardColumn col : columns) {
                if (!col.getId().equals(toDoCol.getId()) &&
                    !col.getId().equals(inProgressCol.getId()) &&
                    !col.getId().equals(inReviewCol.getId()) &&
                    !col.getId().equals(doneCol.getId()) &&
                    !col.getId().equals(uatCol.getId())) {
                    
                    String nameNorm = col.getName().trim().toLowerCase().replace(" ", "");
                    BoardColumn targetCol;
                    if (nameNorm.equals("todo")) {
                        targetCol = toDoCol;
                    } else if (nameNorm.equals("inprogress")) {
                        targetCol = inProgressCol;
                    } else if (nameNorm.equals("inreview")) {
                        targetCol = inReviewCol;
                    } else if (nameNorm.equals("done")) {
                        targetCol = doneCol;
                    } else {
                        targetCol = toDoCol; // fallback
                    }

                    List<Task> tasks = taskRepository.findByColumnId(col.getId());
                    for (Task t : tasks) {
                        t.setColumnId(targetCol.getId());
                        t.setStatus(targetCol.getName());
                        taskRepository.save(t);
                    }

                    columnRepository.delete(col);
                    modified = true;
                }
            }

            if (modified) {
                columns = columnRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
            }
        }
        return columns;
    }

    public BoardColumn addColumn(BoardColumn column) {
        // Set order index to be the last
        List<BoardColumn> existing = columnRepository.findByProjectIdOrderByOrderIndexAsc(column.getProject().getId());
        column.setOrderIndex(existing.size());
        return columnRepository.save(column);
    }

    public void updateColumn(Long id, BoardColumn details) {
        if (details.getName() != null) {
            BoardColumn column = columnRepository.findById(id).orElseThrow();
            column.setName(details.getName());
            if (details.getOrderIndex() != null) {
                column.setOrderIndex(details.getOrderIndex());
            }
            columnRepository.save(column);
        } else if (details.getOrderIndex() != null) {
            columnRepository.updateOrderIndex(id, details.getOrderIndex());
        }
    }

    public void reorderColumns(List<Long> columnIds) {
        for (int i = 0; i < columnIds.size(); i++) {
            columnRepository.updateOrderIndex(columnIds.get(i), i);
        }
    }

    public void deleteColumn(Long id, Long moveTasksToColumnId) {
        BoardColumn column = columnRepository.findById(id).orElseThrow();
        Long projectId = column.getProject().getId();
        
        List<BoardColumn> allColumns = columnRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
        
        if (allColumns.size() <= 1) {
            throw new RuntimeException("Cannot delete the last column of a project.");
        }

        // Handle tasks in the column
        List<Task> tasksInColumn = taskRepository.findByColumnId(id);
        if (!tasksInColumn.isEmpty()) {
            if (moveTasksToColumnId == null) {
                throw new RuntimeException("Column has tasks. Please specify a target column to move them to.");
            }
            
            // Validate target column exists and belongs to the same project
            BoardColumn targetColumn = columnRepository.findById(moveTasksToColumnId).orElseThrow();
            if (!targetColumn.getProject().getId().equals(projectId)) {
                throw new RuntimeException("Target column must belong to the same project.");
            }

            // Move tasks
            for (Task task : tasksInColumn) {
                task.setColumnId(moveTasksToColumnId);
                task.setStatus(targetColumn.getName());
                taskRepository.save(task);
            }
        }

        columnRepository.delete(column);
        
        // Re-order remaining columns
        List<BoardColumn> remaining = columnRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).setOrderIndex(i);
            columnRepository.save(remaining.get(i));
        }
    }
}
