import { CommonModule } from '@angular/common';
import { Component, input, model, output, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-login-form',
  standalone: true,
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, CommonModule]
})
export class LoginFormComponent {
  public disabled = input<boolean>(false);
  public labelEmail = input<string>('Email address');
  public labelPassword = input<string>('Password');
  public placeholderEmail = input<string>('name@example.com');
  public placeholderPassword = input<string>('Enter your password');
  public buttonText = input<string>('Continue');

  public email = model<string>('');
  public password = model<string>('');

  public showPassword = signal(false);

  public onsubmit = output<void>();

  public onsubmitClicked() {
    this.onsubmit.emit();
  }

  public toggleShowPassword() {
    this.showPassword.set(!this.showPassword());
  }
}