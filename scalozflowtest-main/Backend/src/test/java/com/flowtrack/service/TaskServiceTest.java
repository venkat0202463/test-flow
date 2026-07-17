package com.flowtrack.service;

import com.flowtrack.model.Project;
import com.flowtrack.model.Task;
import com.flowtrack.model.User;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TaskHistoryService taskHistoryService;

    @InjectMocks
    private TaskService taskService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testUpdateTask_StatusChange_LogsActivity() {
        // Arrange
        Project project = new Project();
        project.setId(1L);

        Task existingTask = new Task();
        existingTask.setId(10L);
        existingTask.setStatus("TODO");
        existingTask.setProject(project);

        Task updatedDetails = new Task();
        updatedDetails.setStatus("DONE");
        updatedDetails.setTitle("Fixed Bug");

        when(taskRepository.findById(10L)).thenReturn(Optional.of(existingTask));
        when(taskRepository.save(any(Task.class))).thenAnswer(i -> i.getArgument(0));

        // Act
        Task result = taskService.updateTask(10L, updatedDetails, null, null);

        // Assert
        assertEquals("DONE", result.getStatus());
        
        // Verify that TASK_MOVED activity was logged
        verify(activityLogService, times(1)).log(
            eq(1L), 
            any(), 
            eq("TASK_MOVED"), 
            eq("TASK"), 
            eq(10L), 
            contains("TASK-10"), 
            eq("TODO"), 
            eq("DONE"), 
            contains("moved")
        );
    }

    @Test
    void testUpdateTask_DoneToTodo_ThrowsException() {
        // Arrange
        Project project = new Project();
        project.setId(1L);

        Task existingTask = new Task();
        existingTask.setId(10L);
        existingTask.setStatus("DONE");
        existingTask.setProject(project);

        Task updatedDetails = new Task();
        updatedDetails.setStatus("TODO");

        when(taskRepository.findById(10L)).thenReturn(Optional.of(existingTask));

        // Act & Assert
        assertThrows(IllegalStateException.class, () -> {
            taskService.updateTask(10L, updatedDetails, null, null);
        });
    }
}
