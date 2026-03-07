import $ from 'jquery';

export default function username(): string {
  return ($('#username').val() as string) || 'Anonymous';
}
