export class UserCancelled extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'UserCancelled'
  }
}
