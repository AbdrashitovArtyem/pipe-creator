import type { PartId, PipeDesign } from './types'
import type { Calc } from './calculator'
import { formatLen } from './format'
import { bendLabel } from './shapes'
import { woodById } from './woods'

const STEM_NAME = {
  vulcanite: 'вулканит',
  acrylic: 'акрил',
  cumberland: 'камберленд',
} as const

export interface PartStory {
  title: string
  role: string
  facts: { label: string; value: string }[]
}

export function describePart(id: PartId, design: PipeDesign, calc: Calc, units: 'mm' | 'in'): PartStory {
  const L = calc.layout
  const len = (mm: number) => formatLen(mm, units)
  switch (id) {
    case 'bowl':
      return {
        title: 'Чаша',
        role: 'Наружная чаша держит жар и лежит в ладони. У бильярда бок чуть выпуклый, у дублина шире кромка, у яблока форма ближе к шару. Наклон вперёд на пару градусов опускает переднюю кромку.',
        facts: [
          { label: 'Высота', value: len(design.bowlHeight) },
          { label: 'Наружный диаметр', value: len(design.bowlDiameter) },
          { label: 'Наклон', value: `${design.cantDeg}°` },
          { label: 'Стенка, минимум', value: len(Math.min(L.rimWall, L.minSideWall)) },
          { label: 'Дерево', value: woodById(design.woodId).name },
        ],
      }
    case 'chamber':
      return {
        title: 'Табачная камера',
        role: 'Диаметр меряют по кромке. Дно круглое: плоское сверло оставляет ступеньку, на ней копится влага. Глубина сама по себе вкус почти не меняет, пока не доходит до крайностей. Ширина меняет и объём, и площадь горения.',
        facts: [
          { label: 'Диаметр', value: len(design.chamberDiameter) },
          { label: 'Глубина', value: len(design.chamberDepth) },
          { label: 'Объём', value: `${calc.chamberVolumeMl.toFixed(1)} мл` },
          { label: 'Ориентир ленты', value: `${calc.tobaccoLowG.toFixed(1)}–${calc.tobaccoHighG.toFixed(1)} г` },
          { label: 'Дерево под дном', value: len(L.heelWall) },
        ],
      }
    case 'airway':
      return {
        title: 'Дымовой канал',
        role: 'Один диаметр в шинке, цапфе и мундштуке, без ступенек. Американский цеховой размер — 5/32″, около 4 мм. У прикуса канал сужают, иначе мундштук не сделать тонким. Тягу сильнее определяет щель, чем эта цифра.',
        facts: [
          { label: 'Диаметр', value: len(design.airwayDiameter) },
          { label: 'Длина в бриаре', value: len(calc.airwayLength) },
          { label: 'Объём канала', value: `${calc.airwayVolumeMl.toFixed(2)} мл` },
          { label: 'Угол к гнезду', value: `${L.drillAngleDeg.toFixed(1)}°` },
        ],
      }
    case 'shank':
      return {
        title: 'Шинка',
        role: 'Шинка соединяет чашу с мундштуком. У бильярда она круглая и примерно равна высоте чаши. Канадец и лесоруб несут длинный овал, бульдог — ромб. Стенка вокруг гнезда важнее наружной красоты.',
        facts: [
          { label: 'Длина', value: len(design.shankLength) },
          { label: 'Диаметр', value: len(design.shankDiameter) },
          { label: 'Сечение', value: sectionName(design.shankSection) },
          { label: 'Стенка у гнезда', value: len(L.shankWall) },
          { label: 'Изгиб', value: bendLabel(design.bend) },
        ],
      }
    case 'mortise':
      return {
        title: 'Гнездо',
        role: 'Отверстие в торце шинки под цапфу. Обычный размер 5/16″. Дно плоское, сверло Форстнера или фреза. Цапфа не должна упираться в дно: оставляют около миллиметра.',
        facts: [
          { label: 'Диаметр', value: len(design.mortiseDiameter) },
          { label: 'Глубина', value: len(design.mortiseDepth) },
          { label: 'Зазор до цапфы', value: len(design.tenonGap) },
        ],
      }
    case 'tenon':
      return {
        title: 'Цапфа',
        role: design.tenonStyle === 'delrin'
          ? 'Вклейка из Delrin скользит и не разбивает гнездо. На тонкой шинке лучше она: при падении чаще ломается цапфа, а не дерево. Торец мундштука держи под прямым углом, иначе стык зевает.'
          : 'Цельная цапфа проточена в том же материале, что мундштук. Диаметр ловят пробной посадкой. Стенка вокруг канала не должна стать бумажной: гнездо 1/4″ и канал 5/32″ уже на грани.',
        facts: [
          { label: 'Тип', value: design.tenonStyle === 'delrin' ? 'Delrin' : 'цельная' },
          { label: 'Длина', value: len(calc.tenonLength) },
          { label: 'Стенка', value: len(calc.tenonWall) },
        ],
      }
    case 'stem':
      return {
        title: 'Мундштук',
        role: 'Большая часть плохой тяги сидит здесь, а не в чаше. Конус сужается от шинки, седло держит толщину и сходит уступом. Длинный мундштук черчвардена уводит чашу от глаз.',
        facts: [
          { label: 'Длина', value: len(design.stemLength) },
          { label: 'Тип', value: design.stemStyle === 'saddle' ? 'седло' : 'конус' },
          { label: 'Материал', value: STEM_NAME[design.stemMaterial] },
        ],
      }
    case 'button':
      return {
        title: 'Прикус',
        role: 'Утолщение на конце, за которое держат зубы. Удобная толщина около 3,6–4,3 мм. Углы чёткие, но не острые. Если канал доведён сверлом 4 мм до самого торца, прикус физически не сделать тоньше канала.',
        facts: [
          { label: 'Толщина', value: len(design.buttonThickness) },
          { label: 'Материал', value: STEM_NAME[design.stemMaterial] },
        ],
      }
    case 'slot':
      return {
        title: 'Щель',
        role: 'Плоский выход канала в последних сантиметрах мундштука. Она сохраняет объём дыма, пока прикус становится тонким. Короткая щель оставляет толстый конец. Края скругляют, дно сводят с каналом без ступеньки, иначе трубка свистит.',
        facts: [
          { label: 'Глубина', value: len(design.slotDepth) },
          { label: 'Высота', value: len(design.slotHeight) },
        ],
      }
  }
}

function sectionName(section: PipeDesign['shankSection']): string {
  switch (section) {
    case 'round':
      return 'круг'
    case 'oval':
      return 'овал'
    case 'diamond':
      return 'ромб'
    case 'square':
      return 'квадрат'
  }
}
