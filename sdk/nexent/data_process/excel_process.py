import io
import os
from copy import deepcopy

import openpyxl


class ExcelProcessor:
    def __init__(self, input_file=None, file_data=None):
        """
        初始化 Excel 处理器
        :param input_file: Excel 文件路径（可选）
        :param file_data: Excel 文件的数据流（可选，可以是二进制数据或文件对象）
        """
        if input_file is None and file_data is None:
            raise ValueError("必须提供 input_file 或 file_data 参数")

        self.input_file = input_file
        self.file_data = file_data

        # 检查数据来源并加载文件
        try:
            if self.input_file:
                # 检查文件是否存在
                if not self._check_file_exists():
                    raise FileNotFoundError(f"文件不存在或不可访问: {self.input_file}")
                # 从文件路径加载
                self.wb_original = openpyxl.load_workbook(self.input_file)
            else:
                # 从数据流加载
                if isinstance(file_data, bytes):
                    # 如果是二进制数据，使用 io.BytesIO 包装
                    file_obj = io.BytesIO(file_data)
                elif hasattr(file_data, 'read'):
                    # 如果是文件对象（如 open() 返回的对象或 io.BytesIO）
                    file_obj = file_data
                else:
                    raise ValueError("file_data 必须是二进制数据或文件对象")

                # 使用 openpyxl 加载数据流
                self.wb_original = openpyxl.load_workbook(file_obj)

            # 创建深拷贝
            self.wb_copy = deepcopy(self.wb_original)
        except Exception as e:
            raise Exception(f"加载 Excel 文件失败: {str(e)}")

    def process(self):
        """
        处理Excel文件并返回内容

        参数:
            output_file (str, optional): 输出的Excel文件路径

        返回:
            tuple: (处理后的内容列表, 输出文件路径)
        """
        contents = []
        for sheet_name in self.wb_original.sheetnames:
            sheet = self.wb_original[sheet_name]
            sheet_copy = self.wb_copy[sheet_name]
            # 如果该表只有一列内容，则将该列内容合并
            if self._is_single_column(sheet):
                content = self._get_content_one_col(sheet, sheet_name)
            else:
                begin_row, max_col = self._get_title_row(sheet_copy)
                self._merge_all_cells(sheet_copy)

                title_key = self._get_title_key(begin_row, sheet)
                remark = self._get_remark(sheet, begin_row)
                content = self._get_excel_content(title_key, remark, sheet, begin_row, sheet_name)
            contents.extend(content)
        return contents

    def _generate_output_filename(self):
        """生成输出文件名"""
        file_dir, file_name = os.path.split(self.input_file)
        name, ext = os.path.splitext(file_name)
        return os.path.join(file_dir, f"{name}_unmerged{ext}")

    def _get_title_row(self, sheet):
        """获取表头行信息"""
        max_col = 0
        position_max_col = 0

        self._merge_columns(sheet)
        for row_idx, row in enumerate(sheet.iter_rows(), start=1):
            non_empty_cells = sum(1 for cell in row if cell.value is not None)

            if non_empty_cells > max_col:
                max_col = non_empty_cells
                position_max_col = row_idx
        return position_max_col, max_col

    def _is_single_column(self, sheet):
        """判断是否只有一列内容"""
        _, max_col = self._get_title_row(sheet)
        return max_col < 2

    def _get_content_one_col(self, sheet, sheet_name):
        """处理只有一列内容的表"""
        content_str = ""
        for row_idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            if any(cell is not None for cell in row):
                content_str = content_str + row[0].replace("\n", "<br>") + "\n"
        return [content_str + "\n————" + sheet_name]

    def _get_remark(self, sheet, begin_row):
        """获取表头前的备注内容"""
        remark = ""
        for row_idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            if not any(cell is not None for cell in row):
                continue
            if row_idx >= begin_row:
                break
            remark = remark + "<br>" + self._join_tuple_elements(row)
        return remark

    def _get_excel_content(self, title_key, remark, sheet, begin_row, sheet_name):
        """获取表格正文内容"""

        def _get_content_row(title_key, row, remark):
            if remark:
                title_key.append("表头前的备注信息")
                row = row + (remark,)

            result = {str(k).replace("\n", "<br>"): str(v).replace("\n", "<br>") for k, v in zip(title_key, row)}
            return self._dict_to_markdown_table(result) + "\n————" + sheet_name

        content = []
        for row_idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            if not any(cell is not None for cell in row):
                continue
            if row_idx <= begin_row:
                continue
            content.append(_get_content_row(title_key, row, remark))
        return content

    def _check_file_exists(self):
        """
        检查文件是否存在且可读
        :return: bool
        """
        return os.path.isfile(self.input_file) and os.access(self.input_file, os.R_OK)

    @staticmethod
    def _dict_to_markdown_table(data):
        """将字典转为Markdown表格"""
        keys = []
        values = []
        for key, value in data.items():
            keys.append("None" if key is None else str(key))
            values.append("None" if key is None else str(value))
        table = "| " + " | ".join(keys) + " |\n"
        table += "| " + " | ".join(["---"] * len(keys)) + " |\n"
        table += "| " + " | ".join(map(str, values)) + " |"
        return table

    @staticmethod
    def _join_tuple_elements(input_tuple):
        """用分号合并元组中的非None元素"""
        return ";".join(str(item) for item in input_tuple if item is not None)

    def _merge_columns(self, sheet):
        """处理列合并"""
        merged_ranges = list(sheet.merged_cells.ranges)

        for merged_range in merged_ranges:
            if str(merged_range)[0] != str(merged_range)[3]:
                continue
            sheet.unmerge_cells(str(merged_range))

        for merged_range in merged_ranges:
            if str(merged_range)[0] != str(merged_range)[3]:
                continue

            min_col, min_row, max_col, max_row = merged_range.bounds
            top_left_value = sheet.cell(row=min_row, column=min_col).value

            for row in range(min_row, max_row + 1):
                for col in range(min_col, max_col + 1):
                    sheet.cell(row=row, column=col).value = top_left_value

    def _get_title_key(self, begin_row, sheet):
        """获取表头键"""
        for row_idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            if not any(cell is not None for cell in row):
                continue
            if row_idx == begin_row:
                return list(row)
        return []

    def _merge_all_cells(self, sheet):
        """合并所有单元格"""
        merged_ranges = list(sheet.merged_cells.ranges)

        for merged_range in merged_ranges:
            sheet.unmerge_cells(str(merged_range))

        for merged_range in merged_ranges:
            min_col, min_row, max_col, max_row = merged_range.bounds
            top_left_value = sheet.cell(row=min_row, column=min_col).value

            for row in range(min_row, max_row + 1):
                for col in range(min_col, max_col + 1):
                    sheet.cell(row=row, column=col).value = top_left_value
