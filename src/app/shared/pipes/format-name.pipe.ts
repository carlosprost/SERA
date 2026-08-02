import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatName',
  standalone: true
})
export class FormatNamePipe implements PipeTransform {
  transform(value: string | undefined | null): string {
    if (!value) return '';
    return value.replace(/_/g, ' ');
  }
}
