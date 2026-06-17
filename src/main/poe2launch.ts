import { app, BrowserWindow, dialog } from 'electron'
import * as fs from 'fs'
import { spawn } from 'child_process'
import * as path from 'path'
import { download, CancelError } from 'electron-dl'

const POE2_INSTALL_PATH_CONFIG = 'poe2-install-path.json'
const POE2_DRIVE_LETTERS = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const POE2_FAST_SCAN_DRIVE_LETTERS = POE2_DRIVE_LETTERS.filter((drive) => drive !== 'Z')
const POE2_INSTALL_PATH_SUFFIXES = [
  'Kakaogames\\Path of Exile2',
  'kakaogames\\Path of Exile2',
  'Daum Games\\Path of Exile2',
  'Kakao Games\\Path of Exile2'
]
const POE2_FAST_SCAN_CHILD_PATHS = [
  '',
  'Path of Exile2',
  'Kakaogames\\Path of Exile2',
  'kakaogames\\Path of Exile2',
  'Daum Games\\Path of Exile2',
  'Kakao Games\\Path of Exile2'
]

export async function poe2Launch(win: BrowserWindow, url: string): Promise<void> {
  // Url Unescape
  const unescapedUrl = decodeURIComponent(url).replace('kakaogamesstarter://', '')
  console.log('Unescaped Url:', unescapedUrl)

  // '|' Split
  const [gameCode, gameStatus, execute, token, userCode] = unescapedUrl.split('|')
  console.log('Game Code:', gameCode)
  console.log('Game Status:', gameStatus)
  console.log('Execute:', execute)
  console.log('Token:', token)
  console.log('User Code:', userCode)

  const executeKakao64 = 'PathOfExile_x64_KG.exe'
  const gamePath = await resolvePoe2InstallPath(win, executeKakao64)

  if (gamePath) {
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
          spawn(`${path.win32.join(gamePath, executeKakao64)}`, ['--kakao', token, userCode], {
            cwd: gamePath
          })
        }
        if (response.response === 1) {
          spawn(`${path.win32.join(gamePath, executeKakao64)}`, {
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
  }
}

async function resolvePoe2InstallPath(win: BrowserWindow, execute: string): Promise<string | null> {
  const gamePath = findPoe2InstallPath(execute)

  if (gamePath) {
    return gamePath
  }

  const response = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['실행 파일 선택', '설치 프로그램 실행', '취소'],
    defaultId: 0,
    cancelId: 2,
    title: 'Path of Exile 2',
    message: 'Path of Exile 2 설치 경로를 찾지 못했습니다.',
    detail: `${execute} 파일을 직접 선택하면 다음 실행부터 해당 경로를 사용합니다.`
  })

  if (response.response === 0) {
    return selectPoe2InstallPath(win, execute)
  }

  if (response.response === 1) {
    try {
      await poe2Setup(win)
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Path of Exile 2',
        message: '설치 프로그램이 표시될것입니다. 설치 완료 후 게임 시작 버튼을 다시 클릭하세요'
      })
    } catch (error) {
      dialog.showMessageBox(win, {
        type: 'error',
        title: 'Path of Exile 2',
        message: '설치 중 오류가 발생했습니다. 다시 시도해주세요\n\n' + getErrorMessage(error)
      })
    }
  }

  return null
}

function findPoe2InstallPath(execute: string): string | null {
  const cachedInstallPath = readCachedPoe2InstallPath(execute)
  if (cachedInstallPath) {
    console.log('Found Path of Exile 2 at cached install path:', cachedInstallPath)
    return cachedInstallPath
  }

  for (const installPath of getKnownPoe2InstallPaths()) {
    if (isPoe2InstallPath(installPath, execute)) {
      console.log('Found Path of Exile 2 at known install path:', installPath)
      return installPath
    }
  }

  for (const drive of POE2_FAST_SCAN_DRIVE_LETTERS) {
    const driveRoot = getDriveRoot(drive)
    try {
      if (!fs.existsSync(driveRoot)) {
        continue
      }

      const entries = fs.readdirSync(driveRoot, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue
        }

        const foundPath = findPoe2InstallPathInFirstLevelDirectory(driveRoot, entry.name, execute)
        if (foundPath) {
          console.log(`Found Path of Exile 2 in ${drive}:`, foundPath)
          return foundPath
        }
      }
    } catch (error) {
      console.warn(`Unable to scan ${driveRoot}:`, error)
    }
  }

  console.log('Path of Exile 2 is not installed')
  return null
}

function getKnownPoe2InstallPaths(): string[] {
  return POE2_DRIVE_LETTERS.flatMap((drive) =>
    POE2_INSTALL_PATH_SUFFIXES.map((suffix) => path.win32.join(getDriveRoot(drive), suffix))
  )
}

function getDriveRoot(drive: string): string {
  return `${drive}:\\`
}

function findPoe2InstallPathInFirstLevelDirectory(
  driveRoot: string,
  directoryName: string,
  execute: string
): string | null {
  for (const childPath of POE2_FAST_SCAN_CHILD_PATHS) {
    const installPath = path.win32.join(driveRoot, directoryName, childPath)
    if (isPoe2InstallPath(installPath, execute)) {
      return installPath
    }
  }

  return null
}

function isPoe2InstallPath(installPath: string, execute: string): boolean {
  return fs.existsSync(path.win32.join(installPath, execute))
}

function readCachedPoe2InstallPath(execute: string): string | null {
  try {
    const config = JSON.parse(fs.readFileSync(getPoe2InstallPathConfigPath(), 'utf-8'))
    if (typeof config.installPath !== 'string') {
      return null
    }

    if (isPoe2InstallPath(config.installPath, execute)) {
      return config.installPath
    }

    console.warn('Cached Path of Exile 2 install path is invalid:', config.installPath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }

    console.warn('Unable to read Path of Exile 2 install path config:', error)
  }

  return null
}

function saveCachedPoe2InstallPath(installPath: string): void {
  const configPath = getPoe2InstallPathConfigPath()
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify({ installPath }, null, 2))
}

function getPoe2InstallPathConfigPath(): string {
  return path.join(app.getPath('userData'), POE2_INSTALL_PATH_CONFIG)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function selectPoe2InstallPath(win: BrowserWindow, execute: string): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Path of Exile 2 실행 파일', extensions: ['exe'] }],
    title: 'Path of Exile 2 실행 파일 선택',
    buttonLabel: '선택',
    defaultPath: path.win32.join('C:\\Kakaogames\\Path of Exile2', execute)
  })

  const selectedPath = (result.filePaths && result.filePaths[0]) || ''
  if (result.canceled || selectedPath === '') {
    return null
  }

  const selectedFileName = path.win32.basename(selectedPath).toLowerCase()
  if (selectedFileName !== execute.toLowerCase()) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Path of Exile 2',
      message: `${execute} 파일을 선택해주세요.`
    })
    return null
  }

  const installPath = path.win32.dirname(selectedPath)
  if (!isPoe2InstallPath(installPath, execute)) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Path of Exile 2',
      message: '선택한 실행 파일을 확인할 수 없습니다.'
    })
    return null
  }

  try {
    saveCachedPoe2InstallPath(installPath)
    console.log('Saved Path of Exile 2 install path:', installPath)
  } catch (error) {
    console.warn('Unable to save Path of Exile 2 install path config:', error)
  }

  return installPath
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
