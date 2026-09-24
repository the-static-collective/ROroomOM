from pathlib import Path
r=Path(__file__).parent
html=(r/'static-room.html').read_text()
base=(r/'app.js').read_text()+'\n'+(r/'live-bridge.js').read_text()+'\n'+(r/'room005.js').read_text()
start=html.index('<script>')+len('<script>')
end=html.index('</script>',start)
html=html[:start]+'\n'+base+'\n'+html[end:]
html=html.replace('STATIC ROOM 004','ROroomOM 005').replace('Field Prototype 004','ROroomOM 005')
(r/'static-room.html').write_text(html)
print('COMPOSED',len(html.encode()),'bytes')
