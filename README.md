# @ig3/sendmail

This is a very simple interface to the Linux `sendmail` command for sending
email.

## Prerequisites

Ensure a compatible `sendmail` command is installed.
 * [Sendmail](http://www.sendmail.org/)
 * [postfix](http://www.postfix.org/)
 * [exim](https://github.com/Exim/exim)
 * anything else that provides a compatible sendmail executable

## Installation

```
$ npm install @ig3/sendmail
```

## Example

```
const sendmail = require('@ig3/sendmail');
sendmail({
  from: 'from@example.com',
  to: 'to@example.com',
  subject: 'Test subject',
  body: 'The body of the email'
})
.then(() => {
  console.log('The email has been sent');
})
.catch(err => {
  console.log('Attempt to send email failed with error: ', err);
});
```

## API

### sendmail(options)

The sendmail function requires an options object as sole argument.

It returns a Promise that resolves after the email has been sent (i.e. the
`sendmail` command has been run successfully to send the email, which may
result in the email being queued rather than sent immediately, depending on
the `sendmail` command implementation.

#### options

##### from

The email address the email is to be from. This must be a single email
address, as a string;

##### replayTo

The email address that replies should be sent to. This must be a single
email address, as a string.

##### to

The email addresses the email should be sent to. This may be a single email
address as a string or an array of one or more email addresses.

##### cc

Email addresses the email should be copied to. This may be a single email
address as a string or an array of zero or more email addresses.

##### bcc

Email addresses the email should be blind copied to. This may be a single
email address as a string or an array of zero or more email addresses.

##### subject

The subject of the email, as a string.

##### path

Path to the `sendmail` command, as a string. Default is 'sendmail'.

##### envelopeFrom

The envelope from address, passed as value of option `-f` of the `sendmail`
command, to set the envelope 'from' address, distinct from the header
'From' address.

##### bodyType

This may be set to 'html' to send a multipart email with an html part and
optional plain text part (see plaintext).

##### body

This is the text of the body of the email as a string. 

##### plaintext

This is the text of the plain text body of the email, as a string.

If bodyType is 'html' then this may be set to include an alternate plain
text part. 
