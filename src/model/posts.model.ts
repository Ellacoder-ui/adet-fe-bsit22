export interface Post {
    post_id: string;
    title: string;
    description: string;
    status: 'Active' | 'Inactive',
    created_at: Date;
}

export interface CreatePost {
    title: string;
    description: string;
    status: 'Active' | 'Inactive'
}