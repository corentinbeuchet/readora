import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageAsset, PublishOutcome } from '@app/core/models/chapter';
import { CreateTaskRequest, ScanlationProject, SubmitTaskRequest, WorkflowTask } from '@app/core/models/scanlation';
import { ApiClient, parseEnvelope } from './api-client';

/** `/api/v1/scanlation/projects`: team members only; what each may do follows their roles in the team (server-checked). */
@Service()
export class ScanlationApi {
  private readonly api = inject(ApiClient);

  /** Turns the task board of one of my team's series on or off (leaders). */
  setBoard(projectId: string, enabled: boolean): Observable<ScanlationProject> {
    return this.api.put<ScanlationProject>(`/scanlation/projects/${projectId}/board`, { enabled });
  }

  createTask(projectId: string, request: CreateTaskRequest): Observable<WorkflowTask> {
    return this.api.post<WorkflowTask>(`/scanlation/projects/${projectId}/tasks`, request);
  }

  claimTask(projectId: string, taskId: string): Observable<WorkflowTask> {
    return this.api.post<WorkflowTask>(`/scanlation/projects/${projectId}/tasks/${taskId}/claim`);
  }

  submitTask(projectId: string, taskId: string, request: SubmitTaskRequest): Observable<WorkflowTask> {
    return this.api.post<WorkflowTask>(`/scanlation/projects/${projectId}/tasks/${taskId}/submit`, request);
  }

  /** QC publishes the chapter; a team's first waits for a moderator (`status` says which). */
  publishTask(projectId: string, taskId: string): Observable<PublishOutcome> {
    return this.api.post<PublishOutcome>(`/scanlation/projects/${projectId}/tasks/${taskId}/publish`);
  }

  /** A task's pages as its last stage left them (the raw pages at first); idle until both ids are set. */
  taskPagesResource(projectId: Signal<string | undefined>, taskId: Signal<string | undefined>): HttpResourceRef<PageAsset[] | undefined> {
    return httpResource<PageAsset[] | undefined>(
      () => {
        const project = projectId();
        const task = taskId();
        return project && task ? this.api.url(`/scanlation/projects/${project}/tasks/${task}/pages`) : undefined;
      },
      { parse: (raw) => parseEnvelope<PageAsset[]>(raw) ?? [] }
    );
  }

  projectResource(projectId: Signal<string | null | undefined>): HttpResourceRef<ScanlationProject | undefined> {
    return httpResource<ScanlationProject | undefined>(
      () => {
        const id = projectId();
        return id ? this.api.url(`/scanlation/projects/${id}`) : undefined;
      },
      { parse: (raw) => parseEnvelope<ScanlationProject>(raw) }
    );
  }
}
