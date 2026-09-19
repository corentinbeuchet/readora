import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateTaskRequest, ScanlationProject, SubmitTaskRequest, WorkflowTask } from '../models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

/** `/api/v1/scanlation/projects` — needs `PROJECT_VIEW` / `TASK_CLAIM` / `TASK_SUBMIT` / `CHAPTER_PUBLISH`. */
@Service()
export class ScanlationApi {
  private readonly api = inject(ApiClient);

  createTask(projectId: string, request: CreateTaskRequest): Observable<WorkflowTask> {
    return this.api.post<WorkflowTask>(`/scanlation/projects/${projectId}/tasks`, request);
  }

  claimTask(projectId: string, taskId: string): Observable<WorkflowTask> {
    return this.api.post<WorkflowTask>(`/scanlation/projects/${projectId}/tasks/${taskId}/claim`);
  }

  submitTask(projectId: string, taskId: string, request: SubmitTaskRequest): Observable<WorkflowTask> {
    return this.api.post<WorkflowTask>(`/scanlation/projects/${projectId}/tasks/${taskId}/submit`, request);
  }

  publishTask(projectId: string, taskId: string): Observable<string> {
    return this.api.post<string>(`/scanlation/projects/${projectId}/tasks/${taskId}/publish`);
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
