import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Invitation to create an account, shown to visitors after the first sections of the home page (US-14): reading is
 * never gated, so the prompt says plainly what an account adds. No popup, no countdown.
 */
@Component({
  selector: 'app-signup-prompt',
  imports: [RouterLink],
  templateUrl: './signup-prompt.html',
  styleUrl: './signup-prompt.scss'
})
export class SignupPrompt {}
