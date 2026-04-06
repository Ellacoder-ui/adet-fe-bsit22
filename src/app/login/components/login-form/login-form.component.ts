import { Component, input, model, output } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login-form',
  standalone: true,
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.scss'],
  imports: [FormsModule, ReactiveFormsModule]
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

  public onsubmit = output<void>();

  public onsubmitClicked() {
    this.onsubmit.emit();
  }
}