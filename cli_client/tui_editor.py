import subprocess
import tempfile
import os
from dataclasses import dataclass
from typing import Any, Iterable
import re

class Row:
    def serialize(self, data: dict[str, Any]) -> str:
        return '\n'

@dataclass
class Annotation(Row):
    text: str
    def serialize(self, data: dict[str, Any]) -> str:
        return '# ' + self.text + '\n'

@dataclass
class Field(Row):
    name: str
    hint: str | None = None
    def serialize(self, data: dict[str, Any]) -> str:
        s = self.name + (f'[{self.hint}]' if self.hint else "") + ': '
        return f'{s: <40}' + str(data.get(self.name, '')) + '\n'
        # return self.name + ': ' + str(data.get(self.name, '')) + (' # ' + self.hint if self.hint else '') + '\n'

def tuiInput(template: str):
    with tempfile.NamedTemporaryFile('w+') as tf:
        tf.write(template)
        tf.seek(0)
        subprocess.run([
            os.getenv('VISUAL') or os.getenv('EDITOR') or 'nano',
            tf.name
        ])
        tf.seek(0)
        return tf.read()

def editDict(schema: Iterable[Row], data: dict[str, Any]):
    result = tuiInput(''.join(
        row.serialize(data) for row in schema
    ))
    newData: dict[str, str | None] = {k: None for k in data}
    for line in result.split('\n'):
        line = line.split('#')[0].strip()
        if not line: continue
        k, v = line.split(':', 1)
        k = re.sub(r'\[[^\]]*\]', '', k.strip())
        v = v.strip()
        # if k not in newData: continue
        newData[k] = v
    return newData

# print(tuiInput('hello'))
if __name__ == '__main__':
    print(editDict(
        [
            Field('a', 'Parameter a'),
            Row(),
            Field('b', 'Guess'),
            Row(),
            Annotation('Enter your data...')
        ],{'a': 'foo', 'b': 'bar'}))
