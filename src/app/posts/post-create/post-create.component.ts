import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PostsService } from '../../../services/posts/posts.service';

@Component({
  selector: 'app-post-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './post-create.component.html',
  styleUrls: ['./post-create.component.scss']
})
export class PostCreateComponent {
  private postsService = inject(PostsService);
  postForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router
  ) {
    this.postForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      status: ['Active', [Validators.required]]
    });
  }

  async onSubmit() {
    if (this.postForm.valid) {
      const payload = {
        title: this.postForm.value.title,
        description: this.postForm.value.description,
        status: this.postForm.value.status
      }

      const result = await this.postsService.createPost(payload);
      console.log("Result", result);
    } else {
      this.postForm.markAllAsTouched();
    }
  }

  onBack() {
    this.router.navigate(['/posts']);
  }
}
