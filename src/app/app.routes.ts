import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { QueueComponent } from './queue/queue.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'queue',
    component: QueueComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];

