export default {
  "input": {
    "specVersion": "0.1",
    "meta": {
      "name": "Test",
      "description": "",
      "icon": "🧊"
    },
    "state": {
      "n": {
        "type": "number",
        "default": 1
      }
    },
    "screens": [
      {
        "id": "main",
        "title": "Test",
        "root": "root"
      }
    ],
    "elements": {
      "root": {
        "type": "Stack",
        "props": {},
        "children": []
      }
    },
    "actions": {
      "bad": {
        "steps": [
          {
            "op": "ai.run",
            "prompt": "Hi",
            "output": {
              "type": "string"
            },
            "into": "n"
          }
        ]
      }
    }
  },
  "expected": {
    "code": "TYPE_MISMATCH",
    "path": "actions.bad.steps[0].into"
  }
};
