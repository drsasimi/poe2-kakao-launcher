import { app, BrowserWindow, dialog } from 'electron'
import * as fs from 'fs'
import { spawn } from 'child_process'
import * as path from 'path'
import { download, CancelError } from 'electron-dl'

export function poe2Launch(win: BrowserWindow, url: string): void {
  // Url Unescape
  const unescapedUrl = decodeURIComponent(url).replace('daumgamestarter://', '')
  console.log('Unescaped Url:', unescapedUrl)

  // '|' Split
  const [gameCode, gameStatus, execute, token, userCode] = unescapedUrl.split('|')
  console.log('Game Code:', gameCode)
  console.log('Game Status:', gameStatus)
  console.log('Execute:', execute)
  console.log('Token:', token)
  console.log('User Code:', userCode)

  const executeKakao32 = 'PathOfExile_KG.exe'
  const executeKakao64 = 'PathOfExile_x64_KG.exe'

  if (poe2IsInstalled(executeKakao64)) {
    dialog
      .showMessageBox(win, {
        type: 'question',
        buttons: [executeKakao64, executeKakao32],
        defaultId: 0,
        title: 'Path of Exile 2',
        message: '어떤 클라이언트로 실행할까요?'
      })
      .then((response) => {
        if (response.response === 0) {
          spawn(`${path.join('C:\\Daum Games\\Path of Exile2', executeKakao64)}`, [
            '--kakao',
            token,
            userCode
          ])
        }
        if (response.response === 1) {
          spawn(`${path.join('C:\\Daum Games\\Path of Exile2', executeKakao32)}`, [
            '--kakao',
            token,
            userCode
          ])
        }
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

  return false
}

async function poe2Setup(win: BrowserWindow): Promise<void> {
  // 다음 주소에서 클라이언트 설치파일 다운로드
  // https://patch.poe2.kakaogames.com/kg_live/Game/poe2/Install/PathOfExile2_Setup.exe
  const url = 'https://patch.poe2.kakaogames.com/kg_live/Game/poe2/Install/PathOfExile2_Setup.exe'

  try {
    await download(win, url, {
      directory: app.getPath('temp'),
      filename: 'PathOfExile2_Setup.exe'
    })

    // 다운로드 완료 후 실행
    const setupPath = path.join(app.getPath('temp'), 'PathOfExile2_Setup.exe')
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
