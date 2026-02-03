import { Routes } from '@angular/router';
import { PostsComponent } from './posts/posts.component';

export const routes: Routes = [
  { path: '', component: PostsComponent }
];

import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('adet-fe-bsit22');
}