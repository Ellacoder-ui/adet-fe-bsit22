import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { lastValueFrom } from "rxjs";
import { CreatePost, Post } from "../../model/posts.model";

@Injectable({
    providedIn: 'root'
})
export class PostsService {
    private http = inject(HttpClient);

    private API_URL = 'http://localhost:3000/posts';

    public async getPosts() {
        return lastValueFrom(
            this.http.get<Post[]>(this.API_URL)
        );
    }

    public async createPost(payload: CreatePost) {
        return lastValueFrom(
            this.http.post<Post>(this.API_URL, payload)
        );
    }

    public async deletePost(postId: string) {
        return lastValueFrom(
            this.http.delete<void>(`${this.API_URL}/${postId}`)
        );
    }
}