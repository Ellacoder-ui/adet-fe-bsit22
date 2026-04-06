import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common'; import { Post } from '../../model/posts.model';
import { Router } from '@angular/router';
import { PostsService } from '../../services/posts/posts.service';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './posts.component.html',
  styleUrls: ['./posts.component.scss']
})
export class PostsComponent implements OnInit {
  private router = inject(Router);
  private postsService = inject(PostsService);

  public posts = signal<Post[]>([]);
  public isLoading = signal<boolean>(false);

  async ngOnInit() {
    const result = await this.postsService.getPosts();
    this.posts.set(result);
  }


  onCreatePost() {
    this.router.navigate(['/posts/create']);
  }

  async onDeletePost(postId: string) {
    try {
      await this.postsService.deletePost(postId);
      this.posts.update(prev => prev.filter(post => post.post_id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  }
}
