export default {
  "input": {
    "specVersion": "0.1",
    "meta": {
      "name": "Test",
      "description": "",
      "icon": "🧊"
    },
    "state": {},
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
            "op": "fetch"
          }
        ]
      }
    }
  },
  "expected": {
    "code": "BAD_ACTION",
    "path": "actions.bad.steps[0].op"
  }
};
