import { app, BrowserWindow, dialog } from 'electron'
import * as fs from 'fs'
import { spawn } from 'child_process'
import * as path from 'path'
import { download, CancelError } from 'electron-dl'

export function poe2Launch(win: BrowserWindow, url: string): void {
  // Url Unescape
  const unescapedUrl = decodeURIComponent(url).replace('kakaogamesStarter://', '')
  console.log('Unescaped Url:', unescapedUrl)

  // '|' Split
  const [gameCode, gameStatus, execute, token, userCode] = unescapedUrl.split('|')
  console.log('Game Code:', gameCode)
  console.log('Game Status:', gameStatus)
  console.log('Execute:', execute)
  console.log('Token:', token)
  console.log('User Code:', userCode)

  const gamePath = 'C:\\Daum Games\\Path of Exile2'
  const executeKakao64 = 'PathOfExile_x64_KG.exe'

  if (poe2IsInstalled(executeKakao64)) {
    dialog
      .showMessageBox(win, {
        type: 'question',
        buttons: [executeKakao64, `${executeKakao64} (글로벌 버전)`],
        defaultId: 0,
        title: 'Path of Exile 2',
        message: '어떤 클라이언트로 실행할까요?'
      })
      .then((response) => {
        if (response.response === 0) {
          spawn(`${path.join(gamePath, executeKakao64)}`, ['--kakao', token, userCode], {
            cwd: gamePath
          })
        }
        if (response.response === 1) {
          spawn(`${path.join(gamePath, executeKakao64)}`, {
            cwd: gamePath
          })
        }
        // if (response.response === 2) {
        //   // 폰트 선택창 표시
        //   dialog
        //     .showOpenDialog(win, {
        //       properties: ['openFile'],
        //       filters: [{ name: 'Fonts', extensions: ['ttf'] }],
        //       title: 'Path of Exile 2 폰트 변경',
        //       message: '적용하실 폰트를 선택하세요. 원복은 취소를 해주세요',
        //       defaultPath: 'Z:\\home\\deck\\'
        //     })
        //     .then((result) => {
        //       const fontPath = (result.filePaths && result.filePaths[0]) || ''
        //       // 취소한 경우 폰트 원복 절차 진행
        //       if (result.canceled || fontPath === '') {
        //         // TODO: 폰트 원복
        //         poe2RestoreFont(win)
        //         return
        //       }

        //       // 폰트 변경 진행
        //       poe2ChangeFont(win, fontPath)
        //     })
        // }
      })
  } else {
    // 설치
    poe2Setup(win)
      .then(() => {
        // 완료 메시지 출력
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'Path of Exile 2',
          message: '설치 프로그램이 표시될것입니다. 설치 완료 후 게임 시작 버튼을 다시 클릭하세요'
        })
      })
      .catch((error) => {
        // 에러 메시지 출력
        dialog.showMessageBox(win, {
          type: 'error',
          title: 'Path of Exile 2',
          message: '설치 중 오류가 발생했습니다. 다시 시도해주세요\n\n' + error.message
        })
      })
  }
}

function poe2IsInstalled(execute: string): boolean {
  // 기본 경로에서 설치되어 있는지 여부를 확인
  // C:\Daum Games\Path of Exile2
  const installPath = 'C:\\Daum Games\\Path of Exile2'

  // 해당 경로에 execute 파일이 있는지 확인
  if (fs.existsSync(path.join(installPath, execute))) {
    return true
  }

  console.log('Path of Exile 2 is not installed')
  return false
}

async function poe2Setup(win: BrowserWindow): Promise<void> {
  // 다음 주소에서 클라이언트 설치파일 다운로드
  // https://patch.poe2.kakaogames.com/kg_live/Game/poe2/Install/PathOfExile2_Setup.exe
  const url = 'https://patch.poe2.kakaogames.com/kg_live/Game/poe2/Install/PathOfExile2_Setup.exe'

  const targetDir = app.getPath('temp')
  console.log('Target Directory:', targetDir)

  // targetDir 경로가 존재하지 않는 경우 폴더 생성
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  try {
    await download(win, url, {
      directory: targetDir,
      filename: 'PathOfExile2_Setup.exe'
    })

    // 다운로드 완료 후 실행
    const setupPath = path.join(targetDir, 'PathOfExile2_Setup.exe')
    console.log('Setup Path:', setupPath)
    spawn(setupPath)
  } catch (error) {
    if (error instanceof CancelError) {
      console.log('Download is canceled')
    } else {
      console.error('Download error:', error)
    }

    throw error
  }
}

// function poe2ChangeFont(win: BrowserWindow, fontPath: string): void {
//   // 먼저 선택된 경로의 폰트를 C:\\Windows\\Fonts 폴더로 'poe2.ttf' 이름으로 복사
//   fs.copyFile(fontPath, 'C:\\Windows\\Fonts\\poe2.ttf', (error) => {
//     if (error) {
//       console.error('poe2ChangeFont::Copy:: ', error)
//       throw error
//     }

//     // 레지스트리 변경
//     // HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts
//     // "POE2 Launcher Font"="poe2.ttf"

//     const targetDir = app.getPath('temp')
//     console.log('Target Directory:', targetDir)

//     // targetDir 경로가 존재하지 않는 경우 폴더 생성
//     if (!fs.existsSync(targetDir)) {
//       fs.mkdirSync(targetDir, { recursive: true })
//     }

//     // 레지스트리 변경 스크립트 생성
//     const regScript = path.join(targetDir, 'poe2_font.reg')
//     fs.writeFileSync(
//       regScript,
//       'Windows Registry Editor Version 5.00\n\n' +
//         '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts]\n' +
//         '"POE2 Launcher Font"="poe2.ttf"\n\n' +
//         '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\FontSubstitutes]\n' +
//         '"Noto Sans CJK TC"="POE2 Launcher Font"\n' +
//         '"Spoqa Han Sans Neo"="POE2 Launcher Font"\n'
//     )

//     // 레지스트리 변경 스크립트 실행
//     spawn('regedit', ['/s', regScript])

//     // 완료 메시지 출력
//     dialog.showMessageBox(win, {
//       type: 'info',
//       title: 'Path of Exile 2',
//       message: '폰트 변경이 완료되었습니다. 런쳐를 재시작해주세요'
//     })
//   })
// }

// function poe2RestoreFont(win: BrowserWindow) {
//   // 레지스트리 항목 삭제
//   // HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts
//   // "POE2 Launcher Font" 삭제
//   // HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\FontSubstitutes
//   // "Noto Sans CJK TC" 및 "Spoqa Han Sans Neo" 삭제

//   const targetDir = app.getPath('temp')
//   console.log('Target Directory:', targetDir)

//   // targetDir 경로가 존재하지 않는 경우 폴더 생성
//   if (!fs.existsSync(targetDir)) {
//     fs.mkdirSync(targetDir, { recursive: true })
//   }

//   // 레지스트리 변경 스크립트 생성
//   const regScript = path.join(targetDir, 'poe2_font_restore.reg')
//   fs.writeFileSync(
//     regScript,
//     'Windows Registry Editor Version 5.00\n\n' +
//       '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts]\n' +
//       '"POE2 Launcher Font"=-\n\n' +
//       '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\FontSubstitutes]\n' +
//       '"Noto Sans CJK TC"=-\n' +
//       '"Spoqa Han Sans Neo"=-\n'
//   )

//   // 레지스트리 변경 스크립트 실행
//   spawn('regedit', ['/s', regScript])

//   // 완료 메시지 출력
//   dialog.showMessageBox(win, {
//     type: 'info',
//     title: 'Path of Exile 2',
//     message: '폰트 변경이 원복되었습니다. 런쳐를 재시작해주세요'
//   })
// }
