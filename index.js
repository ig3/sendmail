'use strict';

const validEmail = require('isemail').validate;
const spawn = require('child_process').spawn;

module.exports = (options = {}) => {
  return Promise.resolve()
  .then(() => {
    if (!options.from) {
      throw new Error('Missing from address');
    }
    if (!validEmail(options.from)) {
      throw new Error('Invalid from address');
    }
    if (!options.to) {
      throw new Error('Missing to address');
    }
    if (!validEmails(options.to)) {
      throw new Error('Invalid to address');
    }
    if (!options.subject) {
      throw new Error('Missing subject');
    }

    const path = options.path || 'sendmail';
    const args = ['-i', '-t'];
    if (options.envelopeFrom) {
      if (!validEmail(options.envelopeFrom)) {
        throw new Error('Invalid envelopeFrom address');
      }
      args.push('-f', options.envelopeFrom);
    }

    return new Promise((resolve, reject) => {
      const sendmail = spawn(path, args);

      sendmail.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error('sendmail exited with code: ' + code));
        }
        resolve();
      });

      sendmail.stdin.end(composeMessage(options));
    });
  });
};

function composeMessage (options) {
  const m = [];
  if (Array.isArray(options.to)) {
    if (options.to.length === 1) {
      m.push('To: ' + options.to[0]);
    } else {
      m.push('To: ' + options.to[0] + ',');
      for (let i = 1; i < options.to.length - 1; i++) {
        const addr = options.to[i];
        m.push(' ' + addr + ',');
      }
      m.push(' ' + options.to[options.to.length - 1]);
    }
  } else {
    m.push('To: ' + options.to);
  }
  if (options.cc) {
    if (Array.isArray(options.cc)) {
      if (options.cc.length === 1) {
        m.push('CC: ' + options.cc[0]);
      } else if (options.cc.length > 1) {
        m.push('CC: ' + options.cc[0] + ',');
        for (let i = 1; i < options.cc.length - 1; i++) {
          const addr = options.cc[i];
          m.push(' ' + addr + ',');
        }
        m.push(' ' + options.cc[options.cc.length - 1]);
      }
    } else {
      m.push('CC: ' + options.cc);
    }
  }
  if (options.bcc) {
    if (Array.isArray(options.bcc)) {
      if (options.bcc.length === 1) {
        m.push('BCC: ' + options.bcc[0]);
      } else if (options.bcc.length > 1) {
        m.push('BCC: ' + options.bcc[0] + ',');
        for (let i = 1; i < options.bcc.length - 1; i++) {
          const addr = options.bcc[i];
          m.push(' ' + addr + ',');
        }
        m.push(' ' + options.bcc[options.bcc.length - 1]);
      }
    } else {
      m.push('BCC: ' + options.bcc);
    }
  }
  m.push('From: ' + options.from);
  m.push('Reply-To: ' + (options.replyTo || options.from));
  m.push('Subject: ' + options.subject);

  if (options.bodyType && options.bodyType.toLowerCase() === 'html') {
    const boundary = generateBoundary(options);
    m.push('Mime-Version: 1.0');
    m.push('Content-Type: multipart/alternative; boundary=' + boundary);
    m.push('Content-Disposition: inline');
    m.push('');
    m.push('--' + boundary);
    m.push('Content-Type: text/html; charset=utf-8');
    m.push('Content-Transfer-Encoding: Base64');
    m.push('Content-Disposition: inline');
    m.push('');
    m.push(encodeBody(options.body));
    m.push('');

    if (options.plaintext) {
      m.push('--' + boundary);
      m.push('Content-Type: text/plain; charset=utf-8');
      m.push('Content-Disposition: inline');
      m.push('');
      m.push(options.plaintext);
      m.push('');
    }

    m.push('--' + boundary + '--');
  } else {
    m.push('');
    m.push(options.body);
    m.push('');
  }
  console.log('m: ', JSON.stringify(m, null, 2));
  return m.join('\n');
}

function encodeBody (plaintext) {
  console.log('plaintext: "' + plaintext + '"');
  const base64 = (Buffer.from(plaintext)).toString('base64');
  const len = base64.length;
  console.log('len: ' + len);
  const size = 100;
  let start = 0;
  const lines = [];

  while (start < len) {
    console.log('start: ' + start);
    lines.push(base64.substring(start, Math.min(len, start + size)));
    start += size;
  }
  console.log('lines: ' + JSON.stringify(lines, null, 2));
  return lines.join('\n');
}

function generateBoundary (options) {
  let boundary = 'boundary';
  while (boundaryInMessage(boundary, options)) {
    boundary = generateRandomBoundaryString(15);
  }
  return boundary;
}

function boundaryInMessage (boundary, options) {
  let flag = false;
  console.log('test boundary: "' + boundary + '"');
  if (options.plaintext) {
    options.plaintext.split('\n')
    .forEach(line => {
      console.log('test line: "' + line + '"');
      if (line === '--' + boundary) {
        flag = true;
      }
    });
  }
  console.log('boundaryInMessage: ' + flag);
  return flag;
}

function generateRandomBoundaryString (length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

function validEmails (value) {
  if (Array.isArray(value)) {
    let valid = true;
    value.forEach(value => {
      if (!validEmail(value)) {
        valid = false;
      }
    });
    return valid;
  } else {
    return validEmail(value);
  }
}
